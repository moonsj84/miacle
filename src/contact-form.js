/* ==========================================================================
   앳더모먼 (AT THE MOMENT) — CONTACT 입력폼 스크립트
   --------------------------------------------------------------------------
   하는 일
   1) 페이지에 놓인 "아임웹 입력폼 위젯"을 찾아 CONTACT 섹션 안으로 이동시킵니다.
      → 폼의 제출 로직은 아임웹 것을 그대로 쓰므로 접수 누락 위험이 없습니다.
   2) 연락처 자동 하이픈, 문의내용 글자 수 카운터 등 입력 편의를 더합니다.
   3) 제출 버튼 중복 클릭을 막습니다.

   중요: 이 스크립트는 submit 을 가로채지(preventDefault) 않습니다.
         스크립트가 실패해도 폼은 아임웹 기본 동작으로 정상 접수됩니다.
   ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------------------
     설정 — 자동 탐색이 실패할 때만 값을 채우세요.
     ---------------------------------------------------------------------- */
  var CONFIG = {
    // 입력폼 위젯을 정확히 지정하고 싶을 때 CSS 선택자를 넣습니다.
    // 예: '#form_b202609115a34b122e2d20' 또는 '.my-form-widget'
    formSelector: '',

    // 문의 내용(textarea) 권장 글자 수. 0 이면 카운터를 표시하지 않습니다.
    counterMax: 1000,

    // 위젯이 늦게 그려지는 경우를 대비한 최대 대기 시간(ms)
    waitTimeout: 8000
  };

  var SLOT_SELECTOR    = '.atm-contact__slot';
  var SECTION_SELECTOR = '.atm-contact';

  /* ----------------------------------------------------------------------
     유틸
     ---------------------------------------------------------------------- */
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  /** 요소에 연결된 라벨/주변 텍스트를 모아 반환 (필드 종류 추론용) */
  function fieldContext(el) {
    var parts = [
      el.getAttribute('name')        || '',
      el.getAttribute('placeholder') || '',
      el.getAttribute('title')       || '',
      el.getAttribute('id')          || ''
    ];

    if (el.id) {
      var lab = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (lab) parts.push(lab.textContent);
    }

    var wrap = el.closest('li, .form_element, .form_item, [class*="element"], [class*="item"], div');
    if (wrap) parts.push(wrap.textContent.slice(0, 120));

    return parts.join(' ').toLowerCase();
  }

  /* ----------------------------------------------------------------------
     1. 아임웹 입력폼 위젯 찾기
     ---------------------------------------------------------------------- */

  /** 이 form 이 우리가 찾는 "문의 입력폼"인지 점수로 판단 */
  function scoreForm(form) {
    // CONTACT 섹션 안에 이미 들어와 있으면 대상 아님
    if (form.closest(SECTION_SELECTOR)) return -1;

    // 헤더/내비/검색 영역의 폼은 제외
    if (form.closest('header, nav, [class*="header"], [class*="gnb"], [class*="search"]')) return -1;

    // 로그인/검색 성격의 폼 제외
    if (form.querySelector('input[type="password"], input[type="search"]')) return -1;

    var textLike = form.querySelectorAll(
      'input[type="text"], input[type="email"], input[type="tel"], input:not([type]), textarea, select'
    ).length;

    if (textLike < 2) return -1;

    var score = textLike;
    if (form.querySelector('textarea')) score += 4;                       // 문의 내용
    if (form.querySelector('input[type="email"], input[type="tel"]')) score += 3;
    if (form.querySelector('input[type="checkbox"]')) score += 2;         // 개인정보 동의
    if (/문의|신청|contact|inquiry|상담/i.test(form.textContent)) score += 5;

    return score;
  }

  /** 위젯 컨테이너(아임웹이 감싼 바깥 박스)까지 올라가서 반환 */
  function widgetContainerOf(form) {
    var node = form;
    var hops = 0;

    while (node.parentElement && hops < 4) {
      var parent = node.parentElement;

      // 위젯 래퍼로 보이면 그것을 옮긴다
      if (parent !== document.body &&
          /widget|form/i.test(parent.className || '') &&
          parent.querySelectorAll('form').length === 1) {
        node = parent;
        hops++;
        continue;
      }
      break;
    }

    return node;
  }

  function findFormWidget() {
    if (CONFIG.formSelector) {
      var picked = document.querySelector(CONFIG.formSelector);
      if (picked) {
        var innerForm = picked.matches('form') ? picked : picked.querySelector('form');
        return innerForm ? widgetContainerOf(innerForm) : picked;
      }
    }

    var best = null;
    var bestScore = 0;

    Array.prototype.forEach.call(document.querySelectorAll('form'), function (form) {
      var s = scoreForm(form);
      if (s > bestScore) { bestScore = s; best = form; }
    });

    return best ? widgetContainerOf(best) : null;
  }

  /* ----------------------------------------------------------------------
     2. 폼을 CONTACT 섹션 안으로 이동
     ---------------------------------------------------------------------- */

  /** 폼이 빠져나간 뒤 껍데기만 남은 컨테이너를 접어 여백이 뜨지 않게 함 */
  function collapseLeftovers(startEl) {
    var node = startEl;
    var hops = 0;

    while (node && node !== document.body && hops < 3) {
      var next = node.parentElement;
      var hasContent = node.textContent.trim() !== '' ||
                       node.querySelector('img, svg, video, iframe, input, form');

      if (!hasContent) node.style.display = 'none';

      node = next;
      hops++;
    }
  }

  function mountForm(slot, widget) {
    if (!slot || !widget || slot.contains(widget)) return false;

    var origin = widget.parentElement;
    slot.appendChild(widget);              // 같은 노드를 옮기므로 이벤트 핸들러는 유지됩니다.
    if (origin) collapseLeftovers(origin);

    slot.setAttribute('data-atm-mounted', 'true');
    return true;
  }

  /* ----------------------------------------------------------------------
     3. 입력 편의 기능
     ---------------------------------------------------------------------- */

  /** 국내 전화번호 자동 하이픈 (02-1234-5678 / 010-1234-5678 / 1588-0000) */
  function formatPhone(raw) {
    var d = raw.replace(/\D/g, '').slice(0, 11);
    if (!d) return '';

    if (d.startsWith('02')) {                       // 서울 지역번호
      if (d.length < 3)  return d;
      if (d.length < 7)  return d.slice(0, 2) + '-' + d.slice(2);
      if (d.length < 10) return d.slice(0, 2) + '-' + d.slice(2, 5) + '-' + d.slice(5);
      return d.slice(0, 2) + '-' + d.slice(2, 6) + '-' + d.slice(6, 10);
    }

    // 1588 / 1544 등 대표번호 (지역번호 없이 8자리)
    if (/^1[0-9]{3}$/.test(d.slice(0, 4)) && !d.startsWith('10') && d.length <= 8) {
      if (d.length < 5) return d;
      return d.slice(0, 4) + '-' + d.slice(4);
    }

    if (d.length < 4)  return d;
    if (d.length < 8)  return d.slice(0, 3) + '-' + d.slice(3);
    return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7, 11);
  }

  function enhancePhone(input) {
    if (input.dataset.atmPhone) return;
    input.dataset.atmPhone = '1';

    input.setAttribute('inputmode', 'numeric');
    if (!input.getAttribute('placeholder')) {
      input.setAttribute('placeholder', '010-0000-0000');
    }

    input.addEventListener('input', function () {
      var atEnd = input.selectionStart === input.value.length;
      var next  = formatPhone(input.value);
      if (next === input.value) return;

      input.value = next;
      if (atEnd) {
        // 커서를 항상 끝에 유지 (하이픈 삽입으로 커서가 튀는 것 방지)
        try { input.setSelectionRange(next.length, next.length); } catch (e) {}
      }
    });
  }

  function enhanceEmail(input) {
    input.setAttribute('inputmode', 'email');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    if (!input.getAttribute('placeholder')) {
      input.setAttribute('placeholder', 'name@example.com');
    }
  }

  /** 문의 내용 글자 수 카운터 */
  function enhanceTextarea(ta) {
    if (!CONFIG.counterMax || ta.readOnly || ta.dataset.atmCounter) return;
    ta.dataset.atmCounter = '1';

    var counter = document.createElement('span');
    counter.className = 'atm-counter';

    var render = function () {
      var n = ta.value.length;
      counter.textContent = n.toLocaleString('ko-KR') + ' / ' +
                            CONFIG.counterMax.toLocaleString('ko-KR') + '자';
      counter.setAttribute('data-over', String(n > CONFIG.counterMax));
    };

    ta.addEventListener('input', render);
    render();

    if (ta.parentElement) ta.parentElement.appendChild(counter);
  }

  /* --- 선택지 그룹 / 필수·선택 표시 ------------------------------------ */

  /** 같은 name 을 쓰는 라디오·체크박스가 2개 이상이면 알약형 버튼 그룹으로 */
  function groupChoices(root) {
    var done = {};

    Array.prototype.forEach.call(
      root.querySelectorAll('input[type="radio"], input[type="checkbox"]'),
      function (el) {
        var name = el.name;
        if (!name || done[name]) return;

        var group = root.querySelectorAll('input[name="' + CSS.escape(name) + '"]');
        if (group.length < 2) return;          // 개인정보 동의 같은 단일 체크박스는 제외
        done[name] = true;

        var label = el.closest('label');
        var box   = label ? label.parentElement : el.parentElement;
        if (box) box.classList.add('atm-choice');
      }
    );
  }

  /** 항목명을 감싸는 필드 묶음 찾기 (입력칸을 포함하는 가장 가까운 조상) */
  function fieldGroupOf(titleEl) {
    var node = titleEl.parentElement;
    var hops = 0;

    while (node && hops < 4) {
      if (node.querySelector('input:not([type="hidden"]), select, textarea')) return node;
      node = node.parentElement;
      hops++;
    }
    return null;
  }

  /**
   * 필수가 아닌 항목의 항목명 뒤에 '선택' 배지를 붙입니다.
   * 필수는 빨간 별표, 선택은 회색 배지 — 색이 아니라 형태로도 구분됩니다.
   */
  function markOptional(root) {
    Array.prototype.forEach.call(
      root.querySelectorAll('label, legend, [class*="tit"]'),
      function (t) {
        if (t.dataset.atmOpt) return;
        if (t.querySelector('input, select, textarea')) return;  // 선택지 라벨 자체는 제외
        if (t.closest('.atm-choice')) return;
        if (t.matches('input, textarea, select')) return;

        var group = fieldGroupOf(t);
        if (!group) return;

        t.dataset.atmOpt = '1';

        var required = !!group.querySelector('[required], [aria-required="true"]') ||
                       !!t.querySelector('[class*="require"], .necessary') ||
                       t.textContent.indexOf('*') !== -1;
        if (required) return;

        var badge = document.createElement('span');
        badge.className = 'atm-optional';
        badge.textContent = '선택';
        t.appendChild(badge);
      }
    );
  }

  /** 제출 버튼 중복 클릭 방지 (submit 은 그대로 진행시킴) */
  function guardSubmit(root) {
    var form = root.matches('form') ? root : root.querySelector('form');
    if (!form || form.dataset.atmGuard) return;
    form.dataset.atmGuard = '1';

    form.addEventListener('submit', function () {
      var btn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (!btn) return;

      btn.classList.add('atm-is-sending');

      // 아임웹의 유효성 검사에 걸려 실제 전송이 되지 않았을 수 있으므로
      // 일정 시간 뒤 반드시 원상복구합니다. (버튼이 영영 잠기는 것 방지)
      setTimeout(function () { btn.classList.remove('atm-is-sending'); }, 6000);
    });
  }

  function enhance(root) {
    groupChoices(root);   // markOptional 이 .atm-choice 를 참조하므로 먼저 실행
    markOptional(root);

    Array.prototype.forEach.call(
      root.querySelectorAll('input, textarea, select'),
      function (el) {
        if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button') return;

        var ctx = fieldContext(el);

        if (el.tagName === 'TEXTAREA') {
          enhanceTextarea(el);
          return;
        }

        if (el.type === 'email' || /이메일|e-?mail/.test(ctx)) {
          enhanceEmail(el);
          return;
        }

        if (el.type === 'tel' || /연락처|전화|휴대|핸드폰|phone|mobile|tel/.test(ctx)) {
          enhancePhone(el);
        }
      }
    );

    guardSubmit(root);
  }

  /* ----------------------------------------------------------------------
     4. 실행
     ---------------------------------------------------------------------- */
  function init() {
    var slot = document.querySelector(SLOT_SELECTOR);
    if (!slot) return;                       // CONTACT 섹션이 없는 페이지 → 아무것도 안 함
    if (slot.getAttribute('data-atm-mounted')) return;

    var widget = findFormWidget();

    if (widget) {
      mountForm(slot, widget);
      enhance(slot);
      return true;
    }

    return false;
  }

  ready(function () {
    if (init()) return;

    // 위젯이 비동기로 그려지는 경우를 대비해 잠시 지켜봅니다.
    var observer = new MutationObserver(function () {
      if (init()) stop();
    });

    var stop = function () {
      observer.disconnect();
      clearTimeout(timer);
    };

    observer.observe(document.body, { childList: true, subtree: true });

    var timer = setTimeout(function () {
      observer.disconnect();
      // 끝내 못 찾으면 안내 문구를 지워 빈 카드로 남지 않게 합니다.
      var slot = document.querySelector(SLOT_SELECTOR);
      if (slot && !slot.getAttribute('data-atm-mounted')) {
        slot.innerHTML = '<p class="atm-contact__footnote">입력폼을 불러오지 못했습니다. ' +
                         '아래 연락처로 문의해 주세요.</p>';
      }
    }, CONFIG.waitTimeout);
  });
})();

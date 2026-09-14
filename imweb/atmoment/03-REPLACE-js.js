/* ══════════════════════════════════════════════════════════════════════
   [교체] formsubmit.co 전송 코드 → 아임웹 입력폼 연동
   ----------------------------------------------------------------------
   찾을 것 :  FORMSUBMIT_ENDPOINT 변수를 선언하는 줄
              ... 부터 ...
              「YouTube 컨트롤 (postMessage 방식)」 주석 줄 직전까지

   교체할 것: 아래 전체 (YouTube 주석 줄부터는 그대로 두세요)

   무엇이 달라지나
   - 문의가 제3자 서비스(formsubmit.co)를 거쳐 메일로만 가던 것을
     아임웹 입력폼으로 보내 관리자 > 입력폼에 기록으로 남깁니다.
   - 첨부파일이 이름만 메일에 적히고 실제로는 버려지던 문제가 없어집니다.
     (아임웹 입력폼의 파일 첨부 항목이 실제로 파일을 받습니다)
   ══════════════════════════════════════════════════════════════════════ */

  /* ── 아임웹 입력폼 위젯을 CONTACT 카드 안으로 이동 ──────────────────
     제출·유효성검사·스팸차단·알림메일은 전부 아임웹이 처리합니다.
     이 스크립트는 위치와 겉모습만 손대므로, 실패해도 접수는 정상입니다. */
  (function () {
    var SLOT = '#atm-formSlot';
    var MAX_WAIT = 8000;

    /* 이 form 이 우리가 찾는 입력폼인지 점수로 판단 */
    function score(form) {
      if (form.closest(SLOT)) return -1;                       /* 이미 들어옴 */
      if (form.closest('header, nav, [class*="gnb"], [class*="search"]')) return -1;
      if (form.querySelector('input[type="password"], input[type="search"]')) return -1;

      var n = form.querySelectorAll(
        'input[type="text"], input[type="email"], input[type="tel"], input:not([type]), textarea, select'
      ).length;
      if (n < 2) return -1;

      var s = n;
      if (form.querySelector('textarea')) s += 4;
      if (form.querySelector('input[type="email"], input[type="tel"]')) s += 3;
      if (form.querySelector('input[type="checkbox"], input[type="radio"]')) s += 2;
      if (/문의|신청|상담|서비스/.test(form.textContent)) s += 5;
      return s;
    }

    /* 아임웹이 감싼 바깥 위젯 박스까지 올라가서 반환 */
    function widgetOf(form) {
      var node = form, hops = 0;
      while (node.parentElement && hops < 4) {
        var p = node.parentElement;
        if (p !== document.body &&
            /widget|form/i.test(p.className || '') &&
            p.querySelectorAll('form').length === 1) {
          node = p; hops++; continue;
        }
        break;
      }
      return node;
    }

    function findWidget() {
      var best = null, bestScore = 0;
      Array.prototype.forEach.call(document.querySelectorAll('form'), function (f) {
        var s = score(f);
        if (s > bestScore) { bestScore = s; best = f; }
      });
      return best ? widgetOf(best) : null;
    }

    /* 폼이 빠져나간 뒤 껍데기만 남은 컨테이너 접기 */
    function collapse(node) {
      var hops = 0;
      while (node && node !== document.body && hops < 3) {
        var next = node.parentElement;
        if (node.textContent.trim() === '' &&
            !node.querySelector('img, svg, iframe, input, form')) {
          node.style.display = 'none';
        }
        node = next; hops++;
      }
    }

    /* ── 겉모습 보강 ── */

    /* 같은 name 의 라디오·체크박스가 2개 이상이면 알약 버튼 그룹으로 */
    function groupChoices(root) {
      var done = {};
      Array.prototype.forEach.call(
        root.querySelectorAll('input[type="radio"], input[type="checkbox"]'),
        function (el) {
          var name = el.name;
          if (!name || done[name]) return;
          if (root.querySelectorAll('input[name="' + CSS.escape(name) + '"]').length < 2) return;
          done[name] = true;
          var label = el.closest('label');
          var box = label ? label.parentElement : el.parentElement;
          if (box) box.classList.add('cf-choice');
        }
      );
    }

    /* 필수가 아닌 항목명 뒤에 '선택' 배지 */
    function markOptional(root) {
      Array.prototype.forEach.call(
        root.querySelectorAll('label, legend, [class*="tit"]'),
        function (t) {
          if (t.dataset.cfOpt) return;
          if (t.querySelector('input, select, textarea')) return;
          if (t.closest('.cf-choice')) return;

          var g = t.parentElement, hops = 0;
          while (g && hops < 4) {
            if (g.querySelector('input:not([type="hidden"]), select, textarea')) break;
            g = g.parentElement; hops++;
          }
          if (!g) return;
          t.dataset.cfOpt = '1';

          var required = !!g.querySelector('[required], [aria-required="true"]') ||
                         !!t.querySelector('[class*="require"], .necessary') ||
                         t.textContent.indexOf('*') !== -1;
          if (required) return;

          var b = document.createElement('span');
          b.className = 'cf-opt';
          b.textContent = '선택';
          t.appendChild(b);
        }
      );
    }

    /* 국내 전화번호 자동 하이픈 */
    function fmtPhone(raw) {
      var d = raw.replace(/\D/g, '').slice(0, 11);
      if (!d) return '';
      if (d.indexOf('02') === 0) {
        if (d.length < 3)  return d;
        if (d.length < 7)  return d.slice(0,2) + '-' + d.slice(2);
        if (d.length < 10) return d.slice(0,2) + '-' + d.slice(2,5) + '-' + d.slice(5);
        return d.slice(0,2) + '-' + d.slice(2,6) + '-' + d.slice(6,10);
      }
      if (/^1[0-9]{3}$/.test(d.slice(0,4)) && d.indexOf('10') !== 0 && d.length <= 8) {
        return d.length < 5 ? d : d.slice(0,4) + '-' + d.slice(4);
      }
      if (d.length < 4) return d;
      if (d.length < 8) return d.slice(0,3) + '-' + d.slice(3);
      return d.slice(0,3) + '-' + d.slice(3,7) + '-' + d.slice(7,11);
    }

    function enhance(root) {
      groupChoices(root);
      markOptional(root);

      Array.prototype.forEach.call(root.querySelectorAll('input, textarea'), function (el) {
        if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button') return;

        var wrap = el.closest('li, [class*="element"], [class*="item"], div');
        var ctx = [el.name, el.placeholder, el.id, wrap ? wrap.textContent.slice(0,90) : '']
                    .join(' ').toLowerCase();

        /* 연락처 자동 하이픈 */
        if (el.type === 'tel' || /연락처|전화|휴대|핸드폰|phone|tel/.test(ctx)) {
          if (el.dataset.cfPhone) return;
          el.dataset.cfPhone = '1';
          el.setAttribute('inputmode', 'numeric');
          if (!el.placeholder) el.placeholder = '010-0000-0000';
          el.addEventListener('input', function () {
            var atEnd = el.selectionStart === el.value.length;
            var next = fmtPhone(el.value);
            if (next === el.value) return;
            el.value = next;
            if (atEnd) { try { el.setSelectionRange(next.length, next.length); } catch (e) {} }
          });
          return;
        }

        /* 긴 글 항목에 글자 수 카운터 */
        if (el.tagName === 'TEXTAREA' && !el.readOnly && !el.dataset.cfCount) {
          el.dataset.cfCount = '1';
          var c = document.createElement('span');
          c.className = 'cf-counter';
          var render = function () {
            c.textContent = el.value.length.toLocaleString('ko-KR') + ' / 1,000자';
          };
          el.addEventListener('input', render);
          render();
          if (el.parentElement) el.parentElement.appendChild(c);
        }
      });
    }

    function mount() {
      var slot = document.querySelector(SLOT);
      if (!slot || slot.dataset.mounted) return true;

      var w = findWidget();
      if (!w) return false;

      var origin = w.parentElement;
      slot.appendChild(w);                 /* 같은 노드를 옮기므로 핸들러 유지 */
      if (origin) collapse(origin);
      slot.dataset.mounted = '1';
      enhance(slot);
      return true;
    }

    function start() {
      if (mount()) return;

      var mo = new MutationObserver(function () { if (mount()) stop(); });
      var stop = function () { mo.disconnect(); clearTimeout(timer); };
      mo.observe(document.body, { childList: true, subtree: true });

      var timer = setTimeout(function () {
        mo.disconnect();
        var slot = document.querySelector(SLOT);
        if (slot && !slot.dataset.mounted) {
          slot.innerHTML =
            '<div style="padding:40px 20px;border:1px solid rgba(255,255,255,0.07);' +
            'border-radius:12px;background:rgba(255,255,255,0.02);text-align:center;' +
            'font-size:13px;line-height:1.9;color:rgba(255,255,255,0.4)">' +
            '입력폼을 불러오지 못했습니다.<br>' +
            '왼쪽의 전화 또는 이메일로 문의해 주세요.</div>';
        }
      }, MAX_WAIT);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  })();


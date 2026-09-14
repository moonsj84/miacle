#!/usr/bin/env node
/* ==========================================================================
   빌드 스크립트

     src/contact-section.html (템플릿) + copy.json + contact-form.css/js
        ├─→ dist/<페이지>/imweb-code-widget.html   아임웹 코드 위젯 붙여넣기용
        └─→ preview/<페이지>.html                  브라우저 미리보기

   페이지는 src/copy.json 에 정의합니다. 지금은 main, atmoment 두 개.
   실행: node build.js
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const root  = __dirname;
const read  = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => {
  fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true });
  fs.writeFileSync(path.join(root, p), s);
  console.log(`  ✓ ${p}  (${s.length.toLocaleString()} chars)`);
};

const css      = read('src/contact-form.css');
const js       = read('src/contact-form.js');
const template = read('src/contact-section.html');
const COPY     = JSON.parse(read('src/copy.json'));

const fill = (tpl, c) => tpl
  .replace(/\{\{THEME\}\}/g,       c.theme)
  .replace(/\{\{SIZE\}\}/g,        c.size || 'full')
  .replace(/\{\{EYEBROW\}\}/g,     c.eyebrow)
  .replace(/\{\{TITLE\}\}/g,       c.title)
  .replace(/\{\{LEAD\}\}/g,        c.lead)
  .replace(/\{\{PANEL_TITLE\}\}/g, c.panelTitle)
  .replace(/\{\{PANEL_DESC\}\}/g,  c.panelDesc);

/* --------------------------------------------------------------------------
   아임웹 입력폼 위젯이 그리는 마크업의 근사치 (미리보기 전용)
   -------------------------------------------------------------------------- */
const field = (label, required, control) => `
        <div class="form_element">
          <div class="tit">${label}${required ? '<span class="required">*</span>' : ''}</div>
          <div class="ipt">${control}</div>
        </div>`;

const option = (v) => `<option value="${v}">${v}</option>`;

/* 기존 아임웹 폼의 '서비스 종류' 단계와 동일한 항목 */
const SERVICES = [
  '사진 촬영',
  '영상 제작 (일반)',
  'AI 영상 제작',
  '브랜딩 / 디자인',
  '마케팅 / 콘텐츠 기획',
  '행사 / 이벤트 기록',
  '기타'
];

const radios = (name, items) => `<div>${items.map((v, i) => `
              <label><input type="radio" name="${name}" value="${v}"${i === 0 ? ' required' : ''}> ${v}</label>`
            ).join('')}
            </div>`;

const mockForm = `
    <!-- ↓↓↓ 아임웹 [입력폼] 위젯이 그리는 마크업의 근사치 (미리보기 전용) ↓↓↓ -->
    <div class="widget widget_form" id="mock-imweb-form-widget">
      <form id="frm_form_b202609115a34b122e2d20" novalidate>
${field('원하시는 서비스를 선택해주세요', true, radios('form[0]', SERVICES))}
${field('성함 / 담당자명', true, `<input type="text" name="form[1]" placeholder="홍길동" required>`)}
${field('회사 · 브랜드명', false, `<input type="text" name="form[2]" placeholder="(주)미아클">`)}
${field('연락처', true, `<input type="tel" name="form[3]" required>`)}
${field('이메일', true, `<input type="email" name="form[4]" required>`)}
${field('희망 일정', false, `<input type="text" name="form[5]" placeholder="예) 11월 중순 촬영 희망">`)}
${field('예산 범위', false,
  `<select name="form[6]">
              <option value="">선택해 주세요</option>
              ${['300만원 미만','300 – 500만원','500 – 1,000만원','1,000만원 이상','상담 후 협의']
                .map(option).join('\n              ')}
            </select>`)}
${field('문의 내용', true,
  `<textarea name="form[7]" placeholder="진행하고 싶은 프로젝트, 목적, 일정, 참고 자료 등 알고 계신 만큼만 적어주셔도 충분합니다." required></textarea>`)}
${field('유입 경로', false,
  `<select name="form[8]">
              <option value="">선택해 주세요</option>
              ${['검색','인스타그램','지인 소개','기존 거래처','기타'].map(option).join('\n              ')}
            </select>`)}

        <div class="form_element form_agree">
          <div class="tit">개인정보 수집 및 이용 동의 <span class="required">*</span></div>
          <div class="ipt">
            <textarea readonly rows="4">[수집 항목] 성함, 회사·브랜드명, 연락처, 이메일, 문의 내용
[수집 목적] 문의 접수 및 상담 회신
[보유 기간] 문의 처리 완료 후 1년 이내 파기
동의를 거부하실 수 있으나, 이 경우 문의 접수가 제한됩니다.</textarea>
            <label><input type="checkbox" name="agree" required> 위 내용에 동의합니다.</label>
          </div>
        </div>

        <button type="submit">문의 보내기</button>
      </form>
    </div>`;

/* --------------------------------------------------------------------------
   1. 아임웹 코드 위젯용 단일 블록
   -------------------------------------------------------------------------- */
function buildWidget(c, section) {
  return `<!-- ==========================================================================
     미아클 CONTACT 입력폼 — ${c.label}  ·  아임웹 코드 위젯 붙여넣기용 (자동 생성)
     --------------------------------------------------------------------------
     ⚠️ 이 파일을 직접 고치지 마세요.
        문구는 src/copy.json, 디자인은 src/contact-form.css 를 고친 뒤
        \`node build.js\` 를 실행하면 이 파일이 다시 만들어집니다.

     대상 페이지 : ${c.target}
     톤          : ${c.theme}   (섹션 태그의 data-atm-theme 값으로 변경)
     여백        : ${c.size}   (full = 메인용 넉넉하게 / compact = 하단 CONTACT용)

     설치
       1. 이 파일 전체를 복사합니다.
       2. 아임웹 편집기에서 해당 페이지의 CONTACT 자리에 [코드] 위젯을 추가하고
          복사한 내용을 붙여넣습니다.
       3. 그 코드 위젯 "바로 아래"에 [입력폼] 위젯을 추가하고
          board_code = b202609115a34b122e2d20 인 입력폼을 선택합니다.
       4. 저장 후 편집기가 아닌 "실제 페이지"에서 확인합니다.
     ========================================================================== -->

<style>
${css}
</style>

${section}

<script>
${js}
</script>
`;
}

/* --------------------------------------------------------------------------
   2. 미리보기 페이지 (테마 전환 버튼 포함)
   -------------------------------------------------------------------------- */
function buildPreview(c, section) {
  const others = Object.values(COPY).filter((o) => o.id !== c.id);

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>미아클 CONTACT · ${c.label} 미리보기</title>
<style>
  body {
    margin: 0;
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo',
                 'Noto Sans KR', 'Malgun Gothic', sans-serif;
    background: #fff;
    color: #14110F;
  }

  /* 미리보기용 안내 바 — 실제 사이트에는 포함되지 않습니다. */
  .pv-bar {
    display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
    gap: 10px 16px;
    padding: 12px 20px;
    background: #14110F; color: #fff;
    font-size: 13px; line-height: 1.6;
  }
  .pv-bar strong { font-weight: 700; }
  .pv-bar .pv-note { opacity: .6; }
  .pv-bar a { color: #fff; opacity: .75; }
  .pv-switch { display: flex; gap: 4px; padding: 3px; border-radius: 999px; background: rgba(255,255,255,.1); }
  .pv-switch button {
    padding: 5px 13px; border: 0; border-radius: 999px;
    background: transparent; color: rgba(255,255,255,.6);
    font: inherit; font-size: 12px; cursor: pointer;
  }
  .pv-switch button[aria-pressed="true"] { background: #fff; color: #14110F; font-weight: 700; }

  .pv-above { max-width: 1180px; margin: 0 auto; padding: 72px 20px; border-bottom: 1px solid rgba(20,17,15,.08); }
  .pv-above p { margin: 0; font-size: 13px; letter-spacing: .22em; text-transform: uppercase; color: rgba(20,17,15,.35); }

  /* 위아래 페이지 영역도 테마를 따라가 실제 사이트처럼 보이게 함 */
  body[data-pv="dark"] { background: #0B0B0C; color: #F4F4F5; }
  body[data-pv="dark"] .pv-above { border-bottom-color: rgba(244,244,245,.1); }
  body[data-pv="dark"] .pv-above p { color: rgba(244,244,245,.32); }
  body[data-pv="dark"] .pv-done p { color: rgba(244,244,245,.55); }

  .pv-done { padding: 44px 8px; text-align: center; }
  .pv-done h4 { margin: 0 0 10px; font-size: 19px; }
  .pv-done p  { margin: 0; font-size: 14px; line-height: 1.8; color: rgba(20,17,15,.55); }

${css.split('\n').map((l) => (l ? '  ' + l : l)).join('\n')}
</style>
</head>
<body>

<div class="pv-bar">
  <strong>${c.label}</strong>
  <div class="pv-switch" role="group" aria-label="테마 선택">
    <button type="button" data-pv-theme="dark"  aria-pressed="true">다크</button>
    <button type="button" data-pv-theme="light" aria-pressed="false">라이트</button>
    <button type="button" data-pv-theme="auto"  aria-pressed="false">자동</button>
  </div>
  <span class="pv-note">데모입니다 — 실제 접수는 아임웹 입력폼(b202609115a34b122e2d20)으로 전송됩니다.</span>
  ${others.map((o) => `<a href="${o.id}.html">${o.label} 보기 →</a>`).join(' ')}
</div>

<div class="pv-above"><p>… ${c.label} …</p></div>

${section}

${mockForm}

<script>
${js}
</script>

<script>
  /* 미리보기 전용 — 테마 전환 */
  (function () {
    var section = document.querySelector('.atm-contact');
    var btns = document.querySelectorAll('[data-pv-theme]');

    function apply(name) {
      section.setAttribute('data-atm-theme', name);
      var dark = name === 'dark' ||
                 (name === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.body.setAttribute('data-pv', dark ? 'dark' : 'light');
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.pvTheme === name)); });
    }

    btns.forEach(function (b) { b.addEventListener('click', function () { apply(b.dataset.pvTheme); }); });
    apply(section.getAttribute('data-atm-theme') || 'dark');
  })();

  /* 미리보기 전용 — 실제 전송 대신 완료 화면을 보여줍니다. */
  document.addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    if (!form.checkValidity()) { form.reportValidity(); return; }

    var slot = document.querySelector('.atm-contact__slot');
    if (!slot) return;
    slot.innerHTML =
      '<div class="pv-done">' +
        '<h4>문의가 접수되었습니다</h4>' +
        '<p>영업일 1~2일 이내에 담당자가 연락드리겠습니다.<br>' +
        '<span style="opacity:.7">(미리보기 화면입니다 — 실제로 전송되지 않았습니다.)</span></p>' +
      '</div>';
  });
</script>

</body>
</html>
`;
}

/* --------------------------------------------------------------------------
   실행
   -------------------------------------------------------------------------- */
Object.values(COPY).forEach((c) => {
  const section = fill(template, c);
  write(`dist/${c.id}/imweb-code-widget.html`, buildWidget(c, section));
  write(`preview/${c.id}.html`, buildPreview(c, section));
});

/* preview/index.html 은 메인 미리보기로 둡니다. */
fs.copyFileSync(path.join(root, 'preview/main.html'), path.join(root, 'preview/index.html'));
console.log('  ✓ preview/index.html  (= preview/main.html)');

console.log('\n빌드 완료.\n');

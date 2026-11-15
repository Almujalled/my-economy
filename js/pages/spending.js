// Spending page. Not built yet: see CLAUDE.md, "Roadmap".
const HTML = `
<h1>Spending</h1>
<div class="panel">
  <p><b>This page is not built yet.</b> For now, type your monthly living costs on the Plan page under "Your numbers".</p>
  <p>What it will do:</p>
  <ul class="plain">
    <li>Read the transaction file you export from your bank, in the browser. The file is never uploaded.</li>
    <li>Sort each line into a category, with rules you can change.</li>
    <li>Show spending per month and per category, and feed the average into the Plan page.</li>
  </ul>
</div>`;
export function mount(root) { root.innerHTML = HTML; return {}; }

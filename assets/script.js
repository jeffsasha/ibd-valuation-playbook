    (function () {
      var themeToggle = document.getElementById('themeToggle');
      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var currentTheme = prefersDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', currentTheme);
      function syncThemeControl() {
        var dark = currentTheme === 'dark';
        themeToggle.setAttribute('aria-pressed', String(dark));
        themeToggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        themeToggle.querySelector('.theme-label').textContent = dark ? 'Light mode' : 'Dark mode';
      }
      themeToggle.addEventListener('click', function () {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', currentTheme);
        syncThemeControl();
      });
      syncThemeControl();

      var tabs = Array.prototype.slice.call(document.querySelectorAll('.model-tab'));
      var panels = Array.prototype.slice.call(document.querySelectorAll('.model-panel'));
      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          var key = tab.getAttribute('data-panel');
          tabs.forEach(function (t) { var on = t === tab; t.classList.toggle('active', on); t.setAttribute('aria-selected', String(on)); });
          panels.forEach(function (p) { var on = p.id === 'panel-' + key; p.classList.toggle('active', on); p.hidden = !on; });
        });
      });

      var deepTabs = Array.prototype.slice.call(document.querySelectorAll('.deep-tab'));
      var deepPanels = Array.prototype.slice.call(document.querySelectorAll('.deep-panel'));
      function activateDeepTab(tab, moveFocus) {
        var key = tab.getAttribute('data-deep-panel');
        deepTabs.forEach(function (item) {
          var on = item === tab;
          item.classList.toggle('active', on);
          item.setAttribute('aria-selected', String(on));
          item.setAttribute('tabindex', on ? '0' : '-1');
        });
        deepPanels.forEach(function (panel) {
          var on = panel.id === 'deep-panel-' + key;
          panel.classList.toggle('active', on);
          panel.hidden = !on;
        });
        if (moveFocus) tab.focus();
      }
      deepTabs.forEach(function (tab, index) {
        tab.addEventListener('click', function () { activateDeepTab(tab, false); });
        tab.addEventListener('keydown', function (event) {
          var next = null;
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = deepTabs[(index + 1) % deepTabs.length];
          if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = deepTabs[(index - 1 + deepTabs.length) % deepTabs.length];
          if (event.key === 'Home') next = deepTabs[0];
          if (event.key === 'End') next = deepTabs[deepTabs.length - 1];
          if (next) { event.preventDefault(); activateDeepTab(next, true); }
        });
      });
      if (deepTabs.length) activateDeepTab(deepTabs[0], false);

      document.querySelectorAll('.qa button').forEach(function (button) {
        button.addEventListener('click', function () {
          var item = button.parentElement;
          var open = !item.classList.contains('open');
          item.classList.toggle('open', open);
          button.setAttribute('aria-expanded', String(open));
        });
      });

      var resourceFilters = Array.prototype.slice.call(document.querySelectorAll('.resource-filter'));
      var resourceCards = Array.prototype.slice.call(document.querySelectorAll('.resource-card'));
      var resourceCount = document.getElementById('resourceCount');
      resourceFilters.forEach(function (button) {
        button.addEventListener('click', function () {
          var filter = button.getAttribute('data-resource-filter');
          var visible = 0;
          resourceFilters.forEach(function (item) {
            var on = item === button;
            item.classList.toggle('active', on);
            item.setAttribute('aria-pressed', String(on));
          });
          resourceCards.forEach(function (card) {
            var categories = card.getAttribute('data-resource-category').split(' ');
            var show = filter === 'all' || categories.indexOf(filter) !== -1;
            card.hidden = !show;
            if (show) visible += 1;
          });
          resourceCount.textContent = visible + (visible === 1 ? ' RESOURCE SHOWN' : ' RESOURCES SHOWN');
        });
      });

      var inputIds = ['revenue','growth','margin','tax','da','capex','nwc','wacc','terminal','netdebt','shares'];
      var inputs = {};
      inputIds.forEach(function (id) { inputs[id] = document.getElementById(id); inputs[id].addEventListener('input', renderDCF); });

      function val(id) { return Number(inputs[id].value) || 0; }
      function money(x, decimals) {
        if (!isFinite(x)) return '—';
        var abs = Math.abs(x);
        var sign = x < 0 ? '−' : '';
        return sign + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: decimals || 0, maximumFractionDigits: decimals || 0 });
      }
      function calculate(waccOverride, terminalOverride) {
        var rev = val('revenue');
        var growth = val('growth') / 100;
        var margin = val('margin') / 100;
        var tax = val('tax') / 100;
        var daRate = val('da') / 100;
        var capexRate = val('capex') / 100;
        var nwcRate = val('nwc') / 100;
        var wacc = typeof waccOverride === 'number' ? waccOverride : val('wacc') / 100;
        var tg = typeof terminalOverride === 'number' ? terminalOverride : val('terminal') / 100;
        var rows = [], pv = 0;
        for (var year = 1; year <= 5; year++) {
          rev = rev * (1 + growth);
          var ebitda = rev * margin;
          var da = rev * daRate;
          var ebit = ebitda - da;
          var nopat = ebit * (1 - tax);
          var capex = rev * capexRate;
          var dnwc = rev * nwcRate;
          var fcf = nopat + da - capex - dnwc;
          var pvFcf = fcf / Math.pow(1 + wacc, year);
          pv += pvFcf;
          rows.push({ year: year, revenue: rev, ebitda: ebitda, fcf: fcf, pv: pvFcf });
        }
        var terminalValue = wacc > tg ? rows[4].fcf * (1 + tg) / (wacc - tg) : NaN;
        var pvTerminal = terminalValue / Math.pow(1 + wacc, 5);
        var ev = pv + pvTerminal;
        var equity = ev - val('netdebt');
        var perShare = equity / Math.max(val('shares'), .0001);
        return { rows: rows, pvFcf: pv, terminalValue: terminalValue, pvTerminal: pvTerminal, ev: ev, equity: equity, perShare: perShare, wacc: wacc, tg: tg };
      }

      var chartMetric = 'fcf';
      var selectedChartYear = 4;
      document.querySelectorAll('.chart-mode').forEach(function (button) {
        button.addEventListener('click', function () {
          chartMetric = button.getAttribute('data-metric');
          document.querySelectorAll('.chart-mode').forEach(function (item) {
            var on = item === button;
            item.classList.toggle('active', on);
            item.setAttribute('aria-pressed', String(on));
          });
          renderDCF();
        });
      });

      function renderChart(rows) {
        var max = Math.max.apply(null, rows.map(function (row) { return Math.max(0, row[chartMetric]); })) || 1;
        var label = chartMetric === 'fcf' ? 'Unlevered FCF' : 'Revenue';
        var chart = document.getElementById('chartBars');
        chart.innerHTML = rows.map(function (row, index) {
          var amount = row[chartMetric];
          var height = Math.max(8, Math.round((Math.max(0, amount) / max) * 112));
          var active = index === selectedChartYear;
          return '<div class="chart-bar-wrap"><span class="chart-value">' + money(amount, 0) + 'm</span><button class="chart-bar' + (active ? ' active' : '') + '" type="button" data-chart-year="' + index + '" style="height:' + height + 'px" aria-label="Year ' + row.year + ', ' + label + ' ' + money(amount, 0) + ' million" aria-pressed="' + String(active) + '"></button><span class="chart-year">Y' + row.year + '</span></div>';
        }).join('');
        chart.querySelectorAll('.chart-bar').forEach(function (bar) {
          bar.addEventListener('click', function () {
            selectedChartYear = Number(bar.getAttribute('data-chart-year'));
            renderChart(rows);
          });
        });
        var selected = rows[selectedChartYear] || rows[rows.length - 1];
        document.getElementById('chartReadout').textContent = 'YEAR ' + selected.year + ' · ' + label.toUpperCase() + ' ' + money(selected[chartMetric], 1) + 'm';
      }

      function renderDCF() {
        var r = calculate();
        var valid = isFinite(r.ev) && r.ev > 0;
        document.getElementById('evOut').textContent = valid ? money(r.ev, 0) + 'm' : '—';
        document.getElementById('equityOut').textContent = valid ? money(r.equity, 0) + 'm' : '—';
        document.getElementById('shareOut').textContent = valid ? money(r.perShare, 2) : '—';
        var status = document.getElementById('model-status');
        status.textContent = valid ? 'Base case · Gordon Growth method' : 'WACC must be greater than terminal growth';
        status.style.color = valid ? '' : 'var(--danger)';
        renderChart(r.rows);

        var html = '<div class="projection-row head"><div>$m</div>';
        r.rows.forEach(function (row) { html += '<div>Y' + row.year + '</div>'; });
        html += '</div>';
        ['revenue','ebitda','fcf'].forEach(function (key) {
          html += '<div class="projection-row ' + (key === 'fcf' ? 'fcf' : '') + '"><div>' + (key === 'revenue' ? 'Revenue' : key === 'ebitda' ? 'EBITDA' : 'Unlev. FCF') + '</div>';
          r.rows.forEach(function (row) { html += '<div>' + money(row[key], 0).replace('$','') + '</div>'; });
          html += '</div>';
        });
        document.getElementById('projection').innerHTML = html;

        var baseWacc = val('wacc') / 100;
        var baseTg = val('terminal') / 100;
        var waccs = [baseWacc - .01, baseWacc, baseWacc + .01];
        var tgs = [baseTg + .005, baseTg, baseTg - .005];
        var matrix = '<div class="corner">g \\ WACC</div>';
        waccs.forEach(function (w) { matrix += '<div class="axis">' + (w * 100).toFixed(1) + '%</div>'; });
        tgs.forEach(function (g, gi) {
          matrix += '<div class="axis">' + (g * 100).toFixed(1) + '%</div>';
          waccs.forEach(function (w, wi) {
            var c = calculate(w, g);
            var center = gi === 1 && wi === 1;
            matrix += '<div class="' + (center ? 'center' : '') + '">' + (isFinite(c.perShare) && c.perShare > 0 ? money(c.perShare, 2) : '—') + '</div>';
          });
        });
        document.getElementById('matrix').innerHTML = matrix;
      }

      document.getElementById('downloadCsv').addEventListener('click', function () {
        var r = calculate();
        var lines = [
          ['DCF Model Snapshot','Value'],
          ['Base revenue ($m)',val('revenue')],['Revenue growth (%)',val('growth')],['EBITDA margin (%)',val('margin')],['Cash tax rate (%)',val('tax')],['D&A (% revenue)',val('da')],['Capex (% revenue)',val('capex')],['Change in NWC (% revenue)',val('nwc')],['WACC (%)',val('wacc')],['Terminal growth (%)',val('terminal')],['Net debt ($m)',val('netdebt')],['Diluted shares (m)',val('shares')],[],['Year','Revenue','EBITDA','Unlevered FCF','PV of FCF']
        ];
        r.rows.forEach(function (row) { lines.push([row.year,row.revenue.toFixed(1),row.ebitda.toFixed(1),row.fcf.toFixed(1),row.pv.toFixed(1)]); });
        lines.push([],['Enterprise value ($m)',isFinite(r.ev) ? r.ev.toFixed(1) : 'N/A'],['Equity value ($m)',isFinite(r.equity) ? r.equity.toFixed(1) : 'N/A'],['Value per share ($)',isFinite(r.perShare) ? r.perShare.toFixed(2) : 'N/A']);
        var csv = lines.map(function (row) { return row.map(function (cell) { return '"' + String(cell === undefined ? '' : cell).replace(/"/g,'""') + '"'; }).join(','); }).join('\n');
        var blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'illustrative-dcf-model.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      });

      function updateProgress() {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        var pct = max > 0 ? (window.scrollY / max) * 100 : 0;
        document.getElementById('progress').style.width = Math.min(100, Math.max(0, pct)) + '%';
      }
      window.addEventListener('scroll', updateProgress, { passive: true });
      window.addEventListener('resize', updateProgress);
      renderDCF(); updateProgress();
    })();

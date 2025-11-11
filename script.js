// script.js - complete version (replace your current file with this)
document.addEventListener('DOMContentLoaded', () => {
  // --- DOM ELEMENTS ---
  const headerEl = document.querySelector('header'); // Get header for measurement
  const headerBtns = document.querySelector('.header-buttons');
  const loanAmountInput = document.getElementById('loanAmount');
  const interestRateInput = document.getElementById('interestRate');
  const tenureInput = document.getElementById('tenure');
  const moratoriumInput = document.getElementById('moratorium');
  const allInputs = [loanAmountInput, interestRateInput, tenureInput, moratoriumInput];
  const summaryEmiEl = document.getElementById('summary-emi');
  const summaryInterestEl = document.getElementById('summary-interest');
  const summaryTotalEl = document.getElementById('summary-total');
  const summaryInflationLossEl = document.getElementById('summary-inflation-loss');
  const amortizationBody = document.getElementById('amortization-body');
  const amortizationContainer = document.querySelector('.amortization-table-container');
  const settingsBtn = document.querySelector('.settings-btn');
  const configPopover = document.getElementById('config-popover');
  const startDateInput = document.getElementById('startDate');
  const dateWarningEl = document.getElementById('date-schedule-warning');
  const prepaymentContainer = document.getElementById('prepayment-container'); // may be null
  const prepaymentBtn = document.getElementById('prepayment-btn');
  const prepaymentModalOverlay = document.getElementById('prepayment-modal-overlay');
  const modalCloseBtn = document.getElementById('prepayment-modal-close-btn');
  const howToUseModalOverlay = document.getElementById('how-to-use-modal-overlay');
  const howToUseModalCloseBtn = document.getElementById('how-to-use-modal-close-btn');
  const howToUseBtn = document.getElementById('how-to-use-btn');
  const howToUseIframe = howToUseModalOverlay?.querySelector('iframe');
  const howToUseOriginalSrc = howToUseIframe?.src || '';
  const prepaymentCustomBody = document.getElementById('prepayment-custom-body');
  const addPrepaymentRowBtn = document.getElementById('add-prepayment-row-btn');
  const prepaymentSubmitBtn = document.getElementById('prepayment-submit-btn');
  const customTabBtn = document.querySelector('.tab-btn[data-tab="custom"]');
  const templatesTabBtn = document.querySelector('.tab-btn[data-tab="templates"]');
  const blogsBtn = document.getElementById('blogs-btn');
  const mcpPrepaymentsBox = document.querySelector('.header-prepayment-cta');
  const paymentBreakupChartCanvas = document.getElementById('paymentBreakupChart');
  const amortizationChartCanvas = document.getElementById('amortizationChart');
  const chartLabel = document.querySelector('.label-1');
  const Mutedtext = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#BEBEBE';
  const Whitetext = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#FFFFFF';

  // ▼▼▼ DYNAMIC HEADER HEIGHT LOGIC ▼▼▼
  function updateDrawerPosition() {
    if (!headerEl) return;
    const headerHeight = headerEl.offsetHeight;
    document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
  }
  // ▲▲▲ END OF DYNAMIC HEADER LOGIC ▲▲▲

  // --- STATE & CONSTANTS ---
  let originalScheduleData = [];
  let fullScheduleData = [];
  let todayDateString = "";
  const INFLATION_RATE = 5.85;
  let customPrepaymentRows = [];
  let overallLoanStartDate = new Date();
  let overallLoanEndDate = new Date();
  let originalMetrics = null;

  // --- HELPERS (all declared before usage) ---
  function formatToIndianCurrency(num) {
    if (isNaN(num) || num === undefined) return "-";
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);
  }

  function resetUI() {
    if (summaryEmiEl) summaryEmiEl.textContent = "-";
    if (summaryInterestEl) summaryInterestEl.textContent = "-";
    if (summaryTotalEl) summaryTotalEl.textContent = "-";
    if (summaryInflationLossEl) summaryInflationLossEl.textContent = "-";
    if (amortizationBody) amortizationBody.innerHTML = `<tr class="placeholder-row"><td colspan="6">-</td></tr>`;
    if (amortizationContainer) amortizationContainer.classList.add('hidden');
    if (paymentBreakupChartCanvas) paymentBreakupChartCanvas.classList.add('hidden');
    if (amortizationChartCanvas) amortizationChartCanvas.classList.add('hidden');

    if (mcpPrepaymentsBox) mcpPrepaymentsBox.classList.add('hidden');
    if (prepaymentContainer) prepaymentContainer.style.display = 'none';
    if (chartLabel) chartLabel.classList.remove('hidden');

    document.querySelectorAll('.savings-percent, .summary-sub').forEach(el => {
      el.classList.add('hidden');
      el.style.display = 'none';
    });
    [summaryInflationLossEl, summaryInterestEl, summaryTotalEl].forEach(el => {
      if (el) el.classList.remove('highlighted');
    });
    const tenureSavingsContainer = document.querySelector('.tenure-savings-container');
    if (tenureSavingsContainer) tenureSavingsContainer.classList.add('hidden');

    // Destroy charts if present
    if (window.paymentChart && typeof window.paymentChart.destroy === 'function') {
      try { window.paymentChart.destroy(); } catch (e) {}
    }
    if (window.amortizationChart && typeof window.amortizationChart.destroy === 'function') {
      try { window.amortizationChart.destroy(); } catch (e) {}
    }
  }

  function buildYearlySchedule(monthlySchedule) {
    const yearMap = {};
    (monthlySchedule || []).forEach(row => {
      const y = Number(row.year);
      if (!Number.isFinite(y)) return;
      if (!yearMap[y]) yearMap[y] = { year: y, principal: 0, interest: 0, balance: 0 };
      yearMap[y].principal += Number(row.principal || 0);
      yearMap[y].interest  += Number(row.interest || 0);
      // keep last non-zero balance for the year
      yearMap[y].balance = Number(row.balance || yearMap[y].balance || 0);
    });
    return Object.keys(yearMap).map(k => yearMap[k]).sort((a,b) => a.year - b.year);
  }

  // --- Chart renderers ---
  function renderPaymentBreakupChart(principal, interest) {
    try {
      if (!paymentBreakupChartCanvas) return;
      const ctx = paymentBreakupChartCanvas.getContext('2d');

      if (window.paymentChart && typeof window.paymentChart.destroy === 'function') {
        window.paymentChart.destroy();
      }

      window.paymentChart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['Principal Loan Amount', 'Total Interest'],
          datasets: [{
            data: [principal || 0, interest || 0],
            backgroundColor: ['#404042', '#AED0B6'],
            borderWidth: 0,
            offset: [0, 24]
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',
              align: 'start',
              labels: {
                usePointStyle: true,
                pointStyle: 'rect',
                color: Mutedtext,
                font: { size: 14, family: 'DM Sans' }
              }
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const value = context.raw;
                  const percentage = total ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                  return context.label + ': ' + Number(value).toLocaleString() + ' (' + percentage + ')';
                }
              }
            },
            datalabels: {
              color: Whitetext,
              font: { weight: '700', family: 'DM Sans', size: 14 },
              formatter: (value, ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                return percentage;
              }
            }
          }
        },
        plugins: [ChartDataLabels]
      });
    } catch (err) {
      console.error('renderPaymentBreakupChart error:', err);
    }
  }

  // render amortization table years (clickable year rows) - kept simple
  function renderAmortizationTable(schedule) {
    try {
      if (!amortizationBody) return;
      amortizationBody.innerHTML = "";
      if (!schedule || schedule.length === 0) {
        amortizationBody.innerHTML = `<tr class="placeholder-row"><td colspan="6">-</td></tr>`;
        return;
      }

      // Build list of years in schedule in order of appearance
      const years = schedule.reduce((acc, row) => {
        if (!acc.includes(row.year)) acc.push(row.year);
        return acc;
      }, []);

      let tableHTML = "";
      const hasPrepaymentsAnywhere = schedule.some(row => row.prepayment > 0);

      years.forEach(year => {
        const colSpan = hasPrepaymentsAnywhere ? 6 : 5;
        tableHTML += `
          <tr class="year-row" data-year="${year}">
            <td colspan="${colSpan}">
              <div class="year-cell">
                <span>${year}</span>
                <img src="assets/chevron.svg" alt="Toggle Details" class="toggle-icon">
              </div>
            </td>
          </tr>`;
      });

      amortizationBody.innerHTML = tableHTML;
    } catch (err) {
      console.error('renderAmortizationTable error:', err);
    }
  }

  // Amortization bar+line chart (yearly aggregates)
  function renderAmortizationChart(monthlySchedule) {
    try {
      const canvas = document.getElementById('amortizationChart');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
  
      if (window.amortizationChart && typeof window.amortizationChart.destroy === 'function') {
        window.amortizationChart.destroy();
      }
  
      const yearly = buildYearlySchedule(monthlySchedule || []);
      if (!yearly || yearly.length === 0) {
        window.amortizationChart = new Chart(ctx, {
          type: 'bar',
          data: { labels: [], datasets: [] },
          options: { responsive: true, maintainAspectRatio: false }
        });
        return;
      }
  
      const labels = yearly.map(r => String(r.year));
      const balanceData   = yearly.map(r => Math.round(r.balance  || 0));
      const principalData = yearly.map(r => Math.round(r.principal || 0));
      const interestData  = yearly.map(r => Math.round(r.interest  || 0));
  
      window.amortizationChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Principal',
              data: principalData,
              backgroundColor: '#404042',
              stack: 'payments',
              order: 2
            },
            {
              label: 'Interest',
              data: interestData,
              backgroundColor: '#AED0B6',
              stack: 'payments',
              order: 3
            },
            {
              label: 'Balance',
              data: balanceData,
              type: 'line',
              yAxisID: 'y1',
              borderColor: '#ffffff',
              backgroundColor: '#ffffff',
              tension: 0.25,
              fill: false,
              pointRadius: 3,
              order: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              stacked: true,
              ticks: { color: Mutedtext, font: { family: 'DM Sans' } },
              grid: { color: 'rgba(64,64,64,0.12)' }
            },
            y: {
              stacked: true,
              beginAtZero: true,
              ticks: {
                callback: v => '₹' + Number(v).toLocaleString(),
                color: Mutedtext,
                font: { family: 'DM Sans' }
              },
              title: { // Add title for the left Y-axis
                display: true,
                text: 'Amount towards EMI',
                color: Mutedtext,
                font: { family: 'DM Sans' }
              }
            },
            y1: {
              position: 'right',
              beginAtZero: true,
              grid: { drawOnChartArea: false },
              ticks: {
                callback: v => '₹' + Number(v).toLocaleString(),
                color: Mutedtext,
                font: { family: 'DM Sans' }
              },
              title: { // Add title for the right Y-axis
                display: true,
                text: 'Balance',
                color: Mutedtext,
                font: { family: 'DM Sans' }
              }
            }
          },
          plugins: {
            legend: {
              position: 'bottom',
              align: 'center',
              labels: {
                usePointStyle: true,
                pointStyle: 'rect', // 👈 ensures proper square
                color: Mutedtext,   // 👈 text color respects theme
                font: { size: 14, family: 'DM Sans' }
              }
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                label: ctx => `${ctx.dataset.label}: ₹${Number(ctx.raw).toLocaleString()}`
              }
            }
          }
        }
      });
  
    } catch (err) {
      console.error('renderAmortizationChart error:', err);
    }
  }  

  // ---------- core calculation + orchestration ----------
  function calculateAndDisplayResults() {
    try {
      // hide helper UI first
      document.querySelectorAll('.savings-percent, .summary-sub').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
      });

      const P = parseFloat(loanAmountInput?.value);
      const annualInterestRate = parseFloat(interestRateInput?.value);
      const tenureInYears = parseFloat(tenureInput?.value);
      const moratoriumInYears = parseFloat(moratoriumInput?.value) || 0;

      if (isNaN(P) || isNaN(annualInterestRate) || isNaN(tenureInYears) || P <= 0 || annualInterestRate <= 0 || tenureInYears <= 0) {
        resetUI();
        console.info('calculateAndDisplayResults: invalid inputs, UI reset.');
        return;
      }

      if (amortizationContainer) amortizationContainer.classList.remove('hidden');
      if (paymentBreakupChartCanvas) paymentBreakupChartCanvas.classList.remove('hidden');
      if (amortizationChartCanvas) amortizationChartCanvas.classList.remove('hidden');
      if (chartLabel) chartLabel.classList.add('hidden');
      if (mcpPrepaymentsBox) mcpPrepaymentsBox.classList.remove('hidden');
      if (prepaymentContainer) {
        prepaymentContainer.style.display = 'flex';
        prepaymentContainer.style.justifyContent = 'left';
      }

      const r_actual = (annualInterestRate / 12) / 100;
      const n = Math.round(tenureInYears * 12);
      const m = Math.round(moratoriumInYears * 12);

      const moratoriumSimpleInterest = m > 0 ? P * r_actual * m : 0;
      let effectivePrincipal = P + moratoriumSimpleInterest;

      // compute EMI safely
      let emi = 0;
      if (r_actual > 0 && n > 0) {
        const pow = Math.pow(1 + r_actual, n);
        if (isFinite(pow) && (pow - 1) !== 0) {
          emi = (effectivePrincipal * r_actual * pow) / (pow - 1);
        }
      } else {
        emi = effectivePrincipal / Math.max(1, n);
      }

      const originalTotalInterest = moratoriumSimpleInterest + (emi * n) - P;
      const originalTotalPaid = P + originalTotalInterest;

      originalMetrics = {
        principal: P,
        emi,
        interest: originalTotalInterest,
        total: originalTotalPaid,
        schedule: [],
        annualInterestRate,
        inflationLoss: 0
      };

      // inflation adjusted loss
      const adjustedInterestRate = Math.max(0, annualInterestRate - INFLATION_RATE);
      if (adjustedInterestRate > 0) {
        const r_adjusted = (adjustedInterestRate / 12) / 100;
        const moratoriumSimpleInterestAdjusted = m > 0 ? P * r_adjusted * m : 0;
        let effectivePrincipal_adjusted = P + moratoriumSimpleInterestAdjusted;
        const powA = Math.pow(1 + r_adjusted, n);
        if (isFinite(powA) && (powA - 1) !== 0) {
          const emi_adjusted = (effectivePrincipal_adjusted * r_adjusted * powA) / (powA - 1);
          if (isFinite(emi_adjusted)) {
            originalMetrics.inflationLoss = moratoriumSimpleInterestAdjusted + (emi_adjusted * n) - P;
          }
        }
      }

      // update summary + pie
      try { updateSummary(originalMetrics); } catch (e) { console.warn('updateSummary missing or errored', e); }
      try { renderPaymentBreakupChart(P, originalTotalInterest); } catch (e) { console.warn('renderPaymentBreakupChart missing or errored', e); }

      // parse startDate in d-m-Y format (flatpickr)
      let startDate = null;
      try {
        const raw = (startDateInput && startDateInput.value) ? startDateInput.value.trim() : "";
        if (raw && raw.includes('-')) {
          const parts = raw.split('-');
          if (parts.length === 3) {
            const d = parseInt(parts[0], 10);
            const mth = parseInt(parts[1], 10) - 1;
            const y = parseInt(parts[2], 10);
            const cand = new Date(y, mth, d);
            if (!isNaN(cand)) startDate = cand;
          }
        }
      } catch (e) {
        console.warn('startDate parse failed, falling back to today', e);
      }
      if (!startDate) startDate = new Date();

      // generate monthly schedule
      try {
        originalScheduleData = generateAmortizationData(
          P, emi, r_actual, n, m,
          startDate.getMonth(), startDate.getFullYear()
        );
      } catch (err) {
        console.error('generateAmortizationData failed:', err);
        originalScheduleData = [];
      }

      originalMetrics.schedule = originalScheduleData || [];

      const payoffIdx = (originalScheduleData || []).findIndex(e => e.balance <= 0);
      fullScheduleData = payoffIdx >= 0 ? originalScheduleData.slice(0, payoffIdx + 1) : [...(originalScheduleData || [])];

      try { renderAmortizationTable(fullScheduleData); } catch (e) { console.warn('renderAmortizationTable missing or errored', e); }

      overallLoanStartDate = new Date(startDate);
      const totalLoanMonths = n + m;
      overallLoanEndDate = new Date(startDate);
      overallLoanEndDate.setMonth(overallLoanEndDate.getMonth() + totalLoanMonths);
      try { setupCustomPrepaymentTab(); } catch (e) { console.warn('setupCustomPrepaymentTab missing or errored', e); }

      // render amortization chart
      try { renderAmortizationChart(fullScheduleData); } catch (e) { console.warn('renderAmortizationChart failed', e); }

    } catch (outerErr) {
      console.error('calculateAndDisplayResults fatal error:', outerErr);
      try { resetUI(); } catch (e) {}
    }
  }

  // ---------- amortization generator (monthly) ----------
  function generateAmortizationData(principal, emi, monthlyRate, tenureMonths, moratoriumMonths, startMonthIndex, startYear) {
    let principalBase = principal;
    let accruedMoratoriumInterest = 0;
    let outstanding = principalBase;
    const schedule = [];
    const totalMonths = moratoriumMonths + tenureMonths;
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    for (let i = 0; i < totalMonths; i++) {
      const mi = (startMonthIndex + i) % 12;
      const year = startYear + Math.floor((startMonthIndex + i) / 12);

      let interestPayment = 0, principalPayment = 0, prepayment = 0, totalPayment = 0;

      if (i < moratoriumMonths) {
        interestPayment = principalBase * monthlyRate;
        accruedMoratoriumInterest += interestPayment;
        totalPayment = 0;
        outstanding = principalBase + accruedMoratoriumInterest;
      } else {
        if (i === moratoriumMonths) {
          principalBase += accruedMoratoriumInterest;
          outstanding = principalBase;
          accruedMoratoriumInterest = 0;
        }

        interestPayment = outstanding * monthlyRate;
        principalPayment = Math.max(0, emi - interestPayment);

        if (outstanding <= principalPayment) {
          principalPayment = outstanding;
          totalPayment = principalPayment + interestPayment;
          outstanding = 0;
        } else {
          outstanding -= principalPayment;
          totalPayment = emi;
        }
      }

      schedule.push({
        year,
        month: monthNames[mi],
        principal: principalPayment,
        interest: interestPayment,
        emi: i < moratoriumMonths ? 0 : totalPayment,
        prepayment,
        total: i < moratoriumMonths ? 0 : totalPayment,
        totalPayment: i < moratoriumMonths ? 0 : totalPayment,
        balance: outstanding
      });
    }

    return schedule;
  }

  // ---------- prepayment UI builders ----------
  function setupCustomPrepaymentTab() {
    customPrepaymentRows = [];
    if (prepaymentCustomBody) prepaymentCustomBody.innerHTML = '';
    const firstRow = {
      id: Date.now(),
      startDate: overallLoanStartDate,
      endDate: overallLoanEndDate,
      amount: ''
    };
    customPrepaymentRows.push(firstRow);
    const firstRowEl = createPrepaymentRowElement(firstRow, 0);
    if (prepaymentCustomBody && firstRowEl) prepaymentCustomBody.appendChild(firstRowEl);
  }

  function createPrepaymentRowElement(rowData, index) {
    if (!prepaymentCustomBody) return document.createElement('tr');
    const tr = document.createElement('tr');
    tr.dataset.index = index;
    tr.dataset.id = rowData.id;
    tr.innerHTML = `
      <td class="prepayment-date-cell">
        <div id="prep-start-${rowData.id}" class="input-field-wrapper">
          <input type="text" data-input>
          <img src="assets/calendar.svg" alt="Select Date" class="date-picker-icon" data-toggle>
        </div>
      </td>
      <td class="prepayment-date-cell">
        <div id="prep-end-${rowData.id}" class="input-field-wrapper">
          <input type="text" data-input>
          <img src="assets/calendar.svg" alt="Select Date" class="date-picker-icon" data-toggle>
        </div>
      </td>
      <td>
        <div class="input-field-wrapper">
          <span class="prefix" style="padding: 8px; height: auto;">₹</span>
          <input type="number" class="prepayment-amount-input" placeholder="Enter amount" value="${rowData.amount || ''}" style="text-align: right;">
        </div>
      </td>
      <td class="delete-cell" style="text-align: right; vertical-align: middle;">
        <img src="assets/trash.svg" alt="Delete" class="${index === 0 ? 'delete-icon delete-icon-disabled' : 'delete-icon'}" style="cursor: ${index === 0 ? 'not-allowed' : 'pointer'}; width: 20px; height: 20px; ${index === 0 ? 'opacity: 0.5; filter: grayscale(100%);' : ''}">
      </td>
    `;

    const startPickerEl = tr.querySelector(`#prep-start-${rowData.id}`);
    const endPickerEl = tr.querySelector(`#prep-end-${rowData.id}`);
    const prevRowEndDate = index > 0 ? customPrepaymentRows[index - 1].endDate : null;
    try {
      rowData.startPicker = flatpickr(startPickerEl, { wrap: true, dateFormat: "d-m-Y", defaultDate: rowData.startDate, minDate: prevRowEndDate ? new Date(prevRowEndDate).fp_incr(1) : overallLoanStartDate, maxDate: overallLoanEndDate, onChange: (d) => { rowData.startDate = d[0]; }});
      rowData.endPicker = flatpickr(endPickerEl, { wrap: true, dateFormat: "d-m-Y", defaultDate: rowData.endDate, minDate: rowData.startDate || overallLoanStartDate, maxDate: overallLoanEndDate, onChange: (d) => { rowData.endDate = d[0]; }});
    } catch (e) {
      // flatpickr might be missing or invalid wrappers - ignore gracefully
    }

    if (index > 0) {
      const deleteIcon = tr.querySelector('.delete-icon');
      if (deleteIcon && !deleteIcon.classList.contains('delete-icon-disabled')) {
        deleteIcon.addEventListener('click', () => {
          tr.remove();
          const rowIndexInArray = customPrepaymentRows.findIndex(r => r.id == rowData.id);
          if (rowIndexInArray !== -1) customPrepaymentRows.splice(rowIndexInArray, 1);
        });
      }
    }
    return tr;
  }

  if (addPrepaymentRowBtn) {
    addPrepaymentRowBtn.addEventListener('click', () => {
      if (!prepaymentCustomBody || customPrepaymentRows.length === 0) return;
      const lastRow = customPrepaymentRows[customPrepaymentRows.length - 1];
      if (!lastRow || !lastRow.endDate) return;
      const newStartDate = new Date(lastRow.endDate);
      newStartDate.setDate(newStartDate.getDate() + 1);
      if (newStartDate >= overallLoanEndDate) {
        alert("No more time available in the loan tenure to add another prepayment period.");
        return;
      }
      const newRow = { id: Date.now(), startDate: newStartDate, endDate: overallLoanEndDate, amount: '' };
      customPrepaymentRows.push(newRow);
      const newRowEl = createPrepaymentRowElement(newRow, customPrepaymentRows.length - 1);
      prepaymentCustomBody.appendChild(newRowEl);
      if (lastRow.endPicker) lastRow.endPicker.set('maxDate', new Date(newStartDate).fp_incr(-1));
    });
  }

  if (prepaymentCustomBody) {
    prepaymentCustomBody.addEventListener('input', (e) => {
      if (e.target.classList.contains('prepayment-amount-input')) {
        const tr = e.target.closest('tr');
        if (!tr) return;
        const index = parseInt(tr.dataset.index, 10);
        if (!isNaN(index) && customPrepaymentRows[index]) {
          customPrepaymentRows[index].amount = parseFloat(e.target.value) || 0;
        }
      }
    });
  }

  function validateSinglePrepaymentRow(row) {
    const amount = parseFloat(row.amount);
    return !(isNaN(amount) || amount <= 0 || !(row.startDate instanceof Date) || !(row.endDate instanceof Date) || row.endDate < row.startDate);
  }

  function generate16EMIRulePrepayments(emiAmount, loanStartDate, totalLoanMonths) {
    const prepaymentMap = {};
    let currentDate = new Date(loanStartDate);
    for (let monthIndex = 0; monthIndex < totalLoanMonths; monthIndex++) {
      const cyclePosition = monthIndex % 3;
      if (cyclePosition === 2) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        prepaymentMap[`${year}-${month}`] = emiAmount;
      }
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    return prepaymentMap;
  }

  function calculateScheduleWithPrepayments(originalSchedule, prepaymentRows, loanStartDate) {
    let newSchedule = JSON.parse(JSON.stringify(originalSchedule || []));
    const prepaymentMap = {};

    prepaymentRows.forEach(row => {
      let d = new Date(row.startDate);
      while (d <= row.endDate) {
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        prepaymentMap[key] = (prepaymentMap[key] || 0) + parseFloat(row.amount);
        d.setMonth(d.getMonth() + 1);
      }
    });

    const originalPrincipal = parseFloat(loanAmountInput?.value) || 0;
    const monthlyRate = (parseFloat(interestRateInput?.value) / 12) / 100;
    const moratoriumMonths = (parseFloat(moratoriumInput?.value) || 0) * 12;

    let principalBase = originalPrincipal;
    let accruedMoratoriumInterest = 0;
    let outstanding = principalBase;

    for (let i = 0; i < newSchedule.length; i++) {
      const entry = newSchedule[i];
      const monthKey = `${entry.year}-${new Date(Date.parse(entry.month + " 1, 2012")).getMonth() + 1}`;
      let monthPrepay = prepaymentMap[monthKey] || 0;

      if (i < moratoriumMonths) {
        const interestForMonth = principalBase * monthlyRate;
        accruedMoratoriumInterest += interestForMonth;
        entry.interest = interestForMonth;

        if (monthPrepay > 0) {
          monthPrepay = Math.min(monthPrepay, principalBase);
          principalBase -= monthPrepay;
        }

        entry.prepayment = monthPrepay;
        entry.principal = 0;
        entry.emi = 0;
        entry.total = monthPrepay;
        entry.totalPayment = entry.total;
        outstanding = principalBase + accruedMoratoriumInterest;
        entry.balance = outstanding;
        continue;
      }

      if (i === moratoriumMonths) {
        outstanding = principalBase + accruedMoratoriumInterest;
        accruedMoratoriumInterest = 0;
      }

      const interestForMonth = outstanding * monthlyRate;
      entry.interest = interestForMonth;
      let principalFromEmi = Math.max(0, entry.emi - interestForMonth);
      let prepay = monthPrepay;
      const reduce = principalFromEmi + prepay;

      if (outstanding <= reduce) {
        prepay = Math.max(0, outstanding - principalFromEmi);
        entry.prepayment = prepay;
        entry.principal = Math.min(outstanding, principalFromEmi);
        entry.emi = entry.principal + interestForMonth;
        outstanding = 0;
      } else {
        outstanding -= reduce;
        entry.principal = principalFromEmi;
        entry.prepayment = prepay;
      }

      entry.total = entry.emi + entry.prepayment;
      entry.totalPayment = entry.total;
      entry.balance = outstanding;
    }

    return { schedule: newSchedule, prepayments: prepaymentMap };
  }

  function updateSummary(currentMetrics, original = null) {
    try {
      if (!currentMetrics) return;
      if (summaryEmiEl) summaryEmiEl.textContent = formatToIndianCurrency(currentMetrics.emi);
      if (original) {
        // inflation
        if (summaryInflationLossEl) {
          summaryInflationLossEl.textContent = formatToIndianCurrency(currentMetrics.inflationLoss || 0);
          summaryInflationLossEl.classList.add('highlighted');
        }
        const inflationSaved = (original.inflationLoss || 0) - (currentMetrics.inflationLoss || 0);
        const inflationSavedPercent = original.inflationLoss > 0 ? (inflationSaved / original.inflationLoss) * 100 : 0;
        const inflationPercentEl = document.getElementById('inflation-loss-percent');
        const inflationSavedEl = document.getElementById('inflation-loss-saved');
        if (inflationPercentEl && inflationSavedEl) {
          inflationPercentEl.textContent = `-${inflationSavedPercent.toFixed(0)}%`;
          inflationSavedEl.textContent = formatToIndianCurrency(inflationSaved);
          inflationPercentEl.classList.remove('hidden');
          inflationPercentEl.style.display = 'block';
          inflationSavedEl.closest('.summary-sub').classList.remove('hidden');
          inflationSavedEl.closest('.summary-sub').style.display = 'block';
        }

        if (summaryInterestEl) summaryInterestEl.textContent = formatToIndianCurrency(currentMetrics.interest);
        if (summaryInterestEl) summaryInterestEl.classList.add('highlighted');
        const interestSaved = original.interest - currentMetrics.interest;
        const interestSavedPercent = original.interest > 0 ? (interestSaved / original.interest) * 100 : 0;
        const interestPercentEl = document.getElementById('interest-percent');
        const interestSavedEl = document.getElementById('interest-saved');
        if (interestPercentEl && interestSavedEl) {
          interestPercentEl.textContent = `-${interestSavedPercent.toFixed(0)}%`;
          interestSavedEl.textContent = formatToIndianCurrency(interestSaved);
          interestPercentEl.classList.remove('hidden');
          interestPercentEl.style.display = 'block';
          interestSavedEl.closest('.summary-sub').classList.remove('hidden');
          interestSavedEl.closest('.summary-sub').style.display = 'block';
        }

        if (summaryTotalEl) summaryTotalEl.textContent = formatToIndianCurrency(currentMetrics.total);
        if (summaryTotalEl) summaryTotalEl.classList.add('highlighted');
        const totalSaved = original.total - currentMetrics.total;
        const totalSavedPercent = original.total > 0 ? (totalSaved / original.total) * 100 : 0;
        const totalPercentEl = document.getElementById('total-percent');
        const totalSavedEl = document.getElementById('total-saved');
        if (totalPercentEl && totalSavedEl) {
          totalPercentEl.textContent = `-${totalSavedPercent.toFixed(0)}%`;
          totalSavedEl.textContent = formatToIndianCurrency(totalSaved);
          totalPercentEl.classList.remove('hidden');
          totalPercentEl.style.display = 'block';
          totalSavedEl.closest('.summary-sub').classList.remove('hidden');
          totalSavedEl.closest('.summary-sub').style.display = 'block';
        }

        const tenureSavingsContainer = document.querySelector('.tenure-savings-container');
        const tenureSavingsTextEl = document.getElementById('tenure-savings-text');
        if (tenureSavingsContainer && tenureSavingsTextEl && currentMetrics.schedule && original.schedule) {
          const originalActiveLoanMonths = original.schedule.filter(entry => entry.balance > 0 || entry.emi > 0).length;
          const newActiveLoanMonths = currentMetrics.schedule.filter(entry => entry.balance > 0 || entry.emi > 0).length;
          const tenureReductionMonths = originalActiveLoanMonths - newActiveLoanMonths;
          if (tenureReductionMonths > 0) {
            const yearsReduced = Math.floor(tenureReductionMonths / 12);
            const monthsReduced = tenureReductionMonths % 12;
            let tenureTextParts = [];
            if (yearsReduced > 0) tenureTextParts.push(`${yearsReduced} year${yearsReduced > 1 ? 's' : ''}`);
            if (monthsReduced > 0) tenureTextParts.push(`${monthsReduced} month${monthsReduced > 1 ? 's' : ''}`);
            const dyn = tenureTextParts.join(' & ');
            tenureSavingsTextEl.innerHTML = `you'll close your loan <span class="tenure-highlight">${dyn}</span> prior`;
            tenureSavingsContainer.classList.remove('hidden');
          } else {
            tenureSavingsContainer.classList.add('hidden');
          }
        }
      } else {
        if (summaryInflationLossEl) summaryInflationLossEl.textContent = formatToIndianCurrency(currentMetrics.inflationLoss || 0);
        if (summaryInterestEl) summaryInterestEl.textContent = formatToIndianCurrency(currentMetrics.interest);
        if (summaryTotalEl) summaryTotalEl.textContent = formatToIndianCurrency(currentMetrics.total);
        [summaryInflationLossEl, summaryInterestEl, summaryTotalEl].forEach(el => { if (el) el.classList.remove('highlighted'); });
        document.querySelectorAll('.savings-percent, .summary-sub').forEach(el => {
          el.classList.add('hidden');
          el.style.display = 'none';
        });
        const tenureSavingsContainer = document.querySelector('.tenure-savings-container');
        if (tenureSavingsContainer) tenureSavingsContainer.classList.add('hidden');
      }
    } catch (err) {
      console.error('updateSummary error:', err);
    }
  }

  // ---------- prepayment apply handler ----------
  function applyPrepaymentsAndRecalculate() {
    const isCustomTabActive = customTabBtn && customTabBtn.classList.contains('active');
    const isTemplatesTabActive = templatesTabBtn && templatesTabBtn.classList.contains('active');
    let prepaymentRows = [];

    if (isCustomTabActive) {
      prepaymentRows = customPrepaymentRows.filter(validateSinglePrepaymentRow);
      if (prepaymentRows.length !== customPrepaymentRows.filter(r => r.amount > 0).length) {
        alert("Please correct the inputs in the Custom prepayment entries.");
        return;
      }
    } else if (isTemplatesTabActive) {
      const selectedTemplate = document.querySelector('input[name="prepayment_template"]:checked');
      if (!selectedTemplate) return alert("Please select a template.");
      if (selectedTemplate.value === '16-emi' && originalMetrics && originalScheduleData.length > 0) {
        const totalLoanMonths = originalScheduleData.length;
        const prepaymentMap = generate16EMIRulePrepayments(originalMetrics.emi, overallLoanStartDate, totalLoanMonths);
        prepaymentRows = Object.keys(prepaymentMap).map(key => {
          const [year, month] = key.split('-').map(Number);
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0);
          return { startDate, endDate, amount: prepaymentMap[key] };
        });
      }
    } else {
      return;
    }

    const { schedule: rawSchedule, prepayments: monthlyPrepayments } = calculateScheduleWithPrepayments(originalScheduleData, prepaymentRows, overallLoanStartDate);
    const payoffIdx = rawSchedule.findIndex(entry => entry.balance <= 0);
    const trimmedSchedule = payoffIdx >= 0 ? rawSchedule.slice(0, payoffIdx + 1) : rawSchedule;
    fullScheduleData = trimmedSchedule;
    try { renderAmortizationTable(trimmedSchedule); } catch (e) { console.warn('renderAmortizationTable missing or errored', e); }
    updateSummaryWithSavings(trimmedSchedule, monthlyPrepayments);
    closePrepaymentModal();
  }

  function updateSummaryWithSavings(newSchedule, monthlyPrepayments) {
    if (!newSchedule || newSchedule.length === 0 || !originalMetrics) return;
    const principalAmount = parseFloat(loanAmountInput?.value) || 0;
    const newTotalInterest = newSchedule.reduce((sum, entry) => sum + (entry.interest || 0), 0);
    const newTotalAmount = principalAmount + newTotalInterest;
    let newInflationLoss = 0;
    const adjustedRate = Math.max(0, originalMetrics.annualInterestRate - INFLATION_RATE);
    if (adjustedRate > 0) {
      const r_adjusted = (adjustedRate / 12) / 100;
      const actualMonthsPaid = newSchedule.filter(e => e.balance > 0 || e.emi > 0).length;
      const moratoriumMonths = (parseFloat(moratoriumInput?.value) || 0) * 12;
      let effectivePrincipal_adjusted = principalAmount;
      if (moratoriumMonths > 0) {
        effectivePrincipal_adjusted = principalAmount * Math.pow(1 + r_adjusted, moratoriumMonths);
      }
      const emiAdjustedForNewN = (effectivePrincipal_adjusted * r_adjusted * Math.pow(1 + r_adjusted, actualMonthsPaid)) / (Math.pow(1 + r_adjusted, actualMonthsPaid) - 1);
      if (isFinite(emiAdjustedForNewN)) {
        newInflationLoss = (emiAdjustedForNewN * actualMonthsPaid) - principalAmount;
        newInflationLoss = Math.max(0, newInflationLoss);
      }
    }

    const newMetrics = {
      principal: principalAmount,
      emi: originalMetrics.emi,
      interest: newTotalInterest,
      total: newTotalAmount,
      schedule: newSchedule,
      annualInterestRate: originalMetrics.annualInterestRate,
      inflationLoss: newInflationLoss
    };
    updateSummary(newMetrics, originalMetrics);
  }

  // modal open/close helpers
  function openPrepaymentModal() { if (prepaymentModalOverlay) prepaymentModalOverlay.classList.remove('hidden'); }
  function closePrepaymentModal() { if (prepaymentModalOverlay) prepaymentModalOverlay.classList.add('hidden'); }

  function openHowToUseModal() {
    if (howToUseIframe) howToUseIframe.src = howToUseOriginalSrc;
    if (howToUseModalOverlay) howToUseModalOverlay.classList.remove('hidden');
  }
  function closeHowToUseModal() {
    if (howToUseModalOverlay) howToUseModalOverlay.classList.add('hidden');
    if (howToUseIframe) howToUseIframe.src = '';
  }

  // ---------- EVENTS ----------
  allInputs.forEach(input => {
    if (!input) return;
    input.addEventListener('input', () => {
      const max = parseFloat(input.max);
      if (input.value && parseFloat(input.value) > max) { input.value = max; }
      calculateAndDisplayResults();
    });
  });

  amortizationBody.addEventListener('click', function (e) {
    const yearRow = e.target.closest('.year-row');
    if (!yearRow) return;
    const year = yearRow.dataset.year;
    const wasOpen = yearRow.classList.contains('open');
    document.querySelector('.year-row.open')?.classList.remove('open');
    document.querySelector('.details-container-row')?.remove();
    if (!wasOpen) {
      yearRow.classList.add('open');
      const yearMonths = fullScheduleData.filter(row => String(row.year) === String(year));
      const showingPrepayments = yearMonths.some(row => row.prepayment > 0);
      const colSpan = showingPrepayments ? 6 : 5;
      let totalPrincipal = 0, totalInterest = 0, totalPrepayment = 0, totalPayment = 0;
      let monthRowsHTML = yearMonths.map(row => {
        totalPrincipal += row.principal || 0;
        totalInterest += row.interest || 0;
        totalPrepayment += row.prepayment || 0;
        totalPayment += row.total || 0;

        const totalDisplay = (row.emi > 0 || row.prepayment > 0) ? formatToIndianCurrency(row.total) : '<i>MORATORIUM</i>';
        const principalDisplay = row.emi > 0 ? formatToIndianCurrency(row.principal) : '<i>-</i>';

        if (showingPrepayments) {
          return `
            <tr>
              <td>${row.month}</td>
              <td>${principalDisplay}</td>
              <td>${formatToIndianCurrency(row.interest)}</td>
              <td>${formatToIndianCurrency(row.prepayment)}</td>
              <td>${totalDisplay}</td>
              <td>${formatToIndianCurrency(row.balance)}</td>
            </tr>`;
        } else {
          return `
            <tr>
              <td>${row.month}</td>
              <td>${principalDisplay}</td>
              <td>${formatToIndianCurrency(row.interest)}</td>
              <td>${totalDisplay}</td>
              <td>${formatToIndianCurrency(row.balance)}</td>
            </tr>`;
        }
      }).join('');

      const headerHTML = showingPrepayments
        ? `<th>Month</th><th>To Principal</th><th>To Interest</th><th>Pre-payment</th><th>Total Payment</th><th>Balance</th>`
        : `<th>Month</th><th>To Principal</th><th>To Interest</th><th>Total Payment</th><th>Balance</th>`;

      const footerHTML = showingPrepayments
        ? `<td>Summary</td><td>${formatToIndianCurrency(totalPrincipal)}</td><td>${formatToIndianCurrency(totalInterest)}</td><td>${formatToIndianCurrency(totalPrepayment)}</td><td>${formatToIndianCurrency(totalPayment)}</td><td>-</td>`
        : `<td>Summary</td><td>${formatToIndianCurrency(totalPrincipal)}</td><td>${formatToIndianCurrency(totalInterest)}</td><td>${formatToIndianCurrency(totalPayment)}</td><td>-</td>`;

      const summaryBlock = showingPrepayments
        ? `
          <div class="summary-block">
            <div class="summary-top">
              <div class="summary-title">Summary</div>
              <div class="summary-balance">-</div>
            </div>
            <div class="summary-values with-prepay">
              <div class="sv">${formatToIndianCurrency(totalPrincipal)}</div>
              <div class="sv">${formatToIndianCurrency(totalInterest)}</div>
              <div class="sv">${formatToIndianCurrency(totalPrepayment)}</div>
              <div class="sv">${formatToIndianCurrency(totalPayment)}</div>
            </div>
          </div>`
        : `
          <div class="summary-block">
            <div class="summary-top">
              <div class="summary-title">Summary</div>
              <div class="summary-balance">-</div>
            </div>
            <div class="summary-values">
              <div class="sv">${formatToIndianCurrency(totalPrincipal)}</div>
              <div class="sv">${formatToIndianCurrency(totalInterest)}</div>
              <div class="sv">${formatToIndianCurrency(totalPayment)}</div>
            </div>
          </div>`;

      const detailsTableHTML = `
        <table class="details-table">
          <thead><tr>${headerHTML}</tr></thead>
          <tbody>${monthRowsHTML}</tbody>
          <tfoot>
            <tr class="summary-row summary-desktop">${footerHTML}</tr>
            <tr class="summary-row summary-mobile">
              <td colspan="${colSpan}">${summaryBlock}</td>
            </tr>
          </tfoot>
        </table>`;

      const mobileLegendHTML = `
        <div class="mobile-legend" aria-hidden="true">
          <div class="legend-wrap">
            <div class="legend-row legend-top">
              <div class="legend-title">Month</div>
              <div class="legend-title legend-right">Balance</div>
            </div>
            <div class="legend-row legend-bottom">
              <div class="legend-chip col-30">To Principal</div>
              <div class="legend-chip col-30">To Interest</div>
              <div class="legend-chip col-40">Total Payment</div>
            </div>
          </div>
        </div>`;

      const detailsContainer = document.createElement('tr');
      detailsContainer.className = 'details-container-row';
      detailsContainer.innerHTML = `
        <td colspan="${colSpan}">
          ${mobileLegendHTML}
          ${detailsTableHTML}
        </td>
      `;
      yearRow.insertAdjacentElement('afterend', detailsContainer);
    }
  });

  if (howToUseBtn) howToUseBtn.addEventListener('click', openHowToUseModal);
  if (blogsBtn) blogsBtn.addEventListener('click', () => window.open('https://small-carnation-b33.notion.site/Blogs-Practices-to-become-DEBT-FREE-10x-faster-245fbe91669480cb8d45ca1e94ea06ad?source=copy_link', '_blank', 'noopener'));

  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); if (configPopover) configPopover.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => {
      if (!configPopover) return;
      if (!configPopover.classList.contains('hidden') && !configPopover.contains(e.target) && !settingsBtn.contains(e.target) && !e.target.closest('.flatpickr-calendar')) {
        configPopover.classList.add('hidden');
      }
    });
  }

  if (prepaymentBtn) prepaymentBtn.addEventListener('click', openPrepaymentModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closePrepaymentModal);
  if (prepaymentModalOverlay) prepaymentModalOverlay.addEventListener('click', (e) => { if (e.target === prepaymentModalOverlay) closePrepaymentModal(); });
  if (prepaymentSubmitBtn) prepaymentSubmitBtn.addEventListener('click', applyPrepaymentsAndRecalculate);

  if (howToUseModalCloseBtn) howToUseModalCloseBtn.addEventListener('click', closeHowToUseModal);
  if (howToUseModalOverlay) howToUseModalOverlay.addEventListener('click', (e) => { if (e.target === howToUseModalOverlay) closeHowToUseModal(); });

  const modalTabsContainer = document.querySelector('.modal-tabs');
  if (modalTabsContainer) {
    modalTabsContainer.addEventListener('click', e => {
      const clickedTab = e.target.closest('.tab-btn');
      if (!clickedTab) return;
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      clickedTab.classList.add('active');
      document.getElementById(clickedTab.dataset.tab)?.classList.add('active');
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (prepaymentModalOverlay && !prepaymentModalOverlay.classList.contains('hidden')) closePrepaymentModal();
      if (howToUseModalOverlay && !howToUseModalOverlay.classList.contains('hidden')) closeHowToUseModal();
    }
  });

  // --- INITIALIZATION ---
  try {
    flatpickr("#startDateWrapper", {
      wrap: true,
      dateFormat: "d-m-Y",
      defaultDate: "today",
      onReady: (d, dateStr) => { todayDateString = dateStr; },
      onChange: (d, dateStr) => {
        if (dateWarningEl) dateWarningEl.classList.toggle('hidden', dateStr === todayDateString);
        calculateAndDisplayResults();
      }
    });
  } catch (e) {
    // flatpickr might not be available; ignore
    console.warn('flatpickr init failed (maybe not loaded):', e);
  }

  // Run the drawer position function on page load and on resize
  updateDrawerPosition();
  window.addEventListener('resize', updateDrawerPosition);

  // safe startup after everything is declared
  (function safeInit() {
    window.requestAnimationFrame(() => {
      try {
        resetUI();
        calculateAndDisplayResults();
      } catch (err) {
        console.error('safeInit failed:', err);
      }
    });
  })();

  // --- DRAWER TOGGLE ---
  const menuToggle = document.getElementById('menu-toggle');
  const drawer = document.getElementById('mobile-drawer');
  const overlay = document.getElementById('drawer-overlay');
  const drawerClose = document.getElementById('drawer-close');
  const HAMBURGER_ICON = 'assets/menu.svg';
  const CLOSE_ICON = 'assets/cancel.svg';
  if (headerBtns && drawer) {
    const clone = headerBtns.cloneNode(true);
    clone.classList.remove('header-buttons');
    clone.classList.add('drawer-buttons');
    drawer.appendChild(clone);
    const how = clone.querySelector('#how-to-use-btn');
    const blogs = clone.querySelector('#blogs-btn');
    if (how) {
      how.id = 'drawer-how-to-use-btn';
      how.addEventListener('click', () => {
        openHowToUseModal();
        toggleDrawer();
      });
    }
    if (blogs) {
      blogs.id = 'drawer-blogs-btn';
      blogs.addEventListener('click', () => {
        window.open('https://small-carnation-b33.notion.site/Blogs-Practices-to-become-DEBT-FREE-10x-faster-245fbe91669480cb8d45ca1e94ea06ad?source=copy_link', '_blank', 'noopener');
        toggleDrawer();
      });
    }
  }

  function toggleDrawer() {
    if (!drawer || !overlay || !menuToggle) return;
    const isOpen = drawer.classList.toggle('open');
    overlay.classList.toggle('open', isOpen);
    const img = menuToggle.querySelector('img');
    if (img) img.src = isOpen ? CLOSE_ICON : HAMBURGER_ICON;
  }
  if (menuToggle) menuToggle.addEventListener('click', toggleDrawer);
  if (overlay) overlay.addEventListener('click', toggleDrawer);
  if (drawerClose) drawerClose.addEventListener('click', toggleDrawer);

  const mcpPrepaymentButton = document.querySelector('.header-button[data-name="Button"]');
  if (mcpPrepaymentButton) {
    mcpPrepaymentButton.addEventListener('click', openPrepaymentModal);
  }
});

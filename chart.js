// chart.js — D3.js 시각화 전용 (LocalStorage 직접 접근 금지)

const CAT_COLORS = {
  career:  '#1A7A4A',
  dev:     '#4F46E5',
  home:    '#D97706',
  finance: '#B45309',
  custom1: '#7C3AED',
  custom2: '#DB2777',
  none:    '#9CA3AF'
};

const CAT_NAMES = {
  career: '커리어', dev: '자기계발', home: '집안일',
  finance: '재무', custom1: '커스텀1', custom2: '커스텀2', none: '미분류'
};

function tv() {
  const s = getComputedStyle(document.documentElement);
  const g = k => s.getPropertyValue(k).trim();
  return {
    bg:      g('--color-bg')      || '#F2F2F2',
    surface: g('--color-surface') || '#FFFFFF',
    border:  g('--color-border')  || '#D0D0D0',
    muted:   g('--color-muted')   || '#6B6B6B',
    primary: g('--color-primary') || '#1A7A4A',
    mint:    g('--color-mint')    || '#E8F5EE',
    title:   g('--color-title')   || '#1A1A1A'
  };
}

// ==============================================
// HEATMAP — 26주 GitHub 잔디 스타일
// ==============================================
function renderHeatmap(tasks) {
  const el = document.getElementById('chart-heatmap');
  if (!el) return;
  el.innerHTML = '';

  const c    = tv();
  const done = tasks.filter(t => t.status === 'done' && t.completedAt);

  const WEEKS = 26;
  const CELL  = 13;
  const GAP   = 3;
  const STEP  = CELL + GAP;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const origin = new Date(today);
  origin.setDate(origin.getDate() - WEEKS * 7 + 1);

  const dateMap = new Map();
  done.forEach(t => {
    const k = t.completedAt.split('T')[0];
    dateMap.set(k, (dateMap.get(k) || 0) + 1);
  });
  const maxCount = Math.max(1, ...dateMap.values());

  const W = WEEKS * STEP + 30;
  const H = 7 * STEP + 24;

  const svg = d3.select(el).append('svg')
    .attr('width', '100%')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('role', 'img')
    .attr('aria-label', '날짜별 완료 히트맵');

  const g = svg.append('g').attr('transform', 'translate(28,18)');

  // Day labels
  ['일','월','화','수','목','금','토'].forEach((label, i) => {
    if (i % 2 !== 0) return;
    g.append('text')
      .attr('x', -4).attr('y', i * STEP + CELL - 1)
      .attr('text-anchor', 'end')
      .attr('font-size', '9px')
      .attr('fill', c.muted)
      .attr('font-family', "'Pretendard', sans-serif")
      .text(label);
  });

  const colorScale = d3.scaleSequential()
    .domain([0, maxCount])
    .interpolator(t => t === 0
      ? c.border
      : d3.interpolate(c.mint, c.primary)(t));

  // Build cell data
  const cells = [];
  for (let cur = new Date(origin); cur <= today; cur.setDate(cur.getDate() + 1)) {
    const key = cur.toISOString().split('T')[0];
    cells.push({
      date:  key,
      count: dateMap.get(key) || 0,
      dow:   cur.getDay(),
      week:  Math.floor((cur - origin) / (7 * 86400000))
    });
  }

  // Tooltip
  const tip = d3.select(el).append('div').attr('class', 'd3-tooltip');

  g.selectAll('rect')
    .data(cells)
    .enter()
    .append('rect')
    .attr('x',      d => d.week * STEP)
    .attr('y',      d => d.dow  * STEP)
    .attr('width',  CELL)
    .attr('height', CELL)
    .attr('rx', 3).attr('ry', 3)
    .attr('fill', d => colorScale(d.count))
    .on('mouseenter', (event, d) => {
      tip.style('opacity', '1')
         .html(`${d.date}&nbsp;&nbsp;<strong>${d.count}개 완료</strong>`);
    })
    .on('mousemove', event => {
      const r = el.getBoundingClientRect();
      tip.style('left', (event.clientX - r.left + 12) + 'px')
         .style('top',  (event.clientY - r.top  - 38) + 'px');
    })
    .on('mouseleave', () => tip.style('opacity', '0'));

  // Month labels
  const seen = new Set();
  cells.forEach(cell => {
    const m = cell.date.slice(0, 7);
    if (seen.has(m)) return;
    seen.add(m);
    g.append('text')
      .attr('x', cell.week * STEP)
      .attr('y', -4)
      .attr('font-size', '9px')
      .attr('fill', c.muted)
      .attr('font-family', "'Pretendard', sans-serif")
      .text(cell.date.slice(5, 7) + '월');
  });
}

// ==============================================
// WEEKLY BAR CHART — 최근 8주
// ==============================================
function renderWeekly(tasks) {
  const el = document.getElementById('chart-weekly');
  if (!el) return;
  el.innerHTML = '';

  const c    = tv();
  const done = tasks.filter(t => t.status === 'done' && t.completedAt);
  const now  = new Date();

  const weekData = Array.from({ length: 8 }, (_, i) => {
    const ago   = 7 - i;
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay() - ago * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return {
      label:     ago === 0 ? '이번주' : `${ago}주전`,
      count:     done.filter(t => { const d = new Date(t.completedAt); return d >= start && d <= end; }).length,
      isCurrent: ago === 0
    };
  });

  const W  = el.clientWidth || 300;
  const mt = 12, mr = 8, mb = 28, ml = 26;
  const iw = W - ml - mr;
  const ih = 120 - mt - mb;

  const svg = d3.select(el).append('svg')
    .attr('width', '100%')
    .attr('viewBox', `0 0 ${W} ${120}`)
    .attr('role', 'img')
    .attr('aria-label', '주간 완료 추세');

  const g = svg.append('g').attr('transform', `translate(${ml},${mt})`);

  const x = d3.scaleBand().domain(weekData.map(d => d.label)).range([0, iw]).padding(0.35);
  const y = d3.scaleLinear().domain([0, Math.max(1, d3.max(weekData, d => d.count))]).nice().range([ih, 0]);

  // Grid lines
  g.append('g')
    .call(d3.axisLeft(y).ticks(3).tickSize(-iw))
    .call(gc => gc.select('.domain').remove())
    .call(gc => gc.selectAll('.tick line').attr('stroke', c.border).attr('stroke-dasharray', '3,3'))
    .call(gc => gc.selectAll('.tick text').attr('fill', c.muted).attr('font-size', '9px').attr('font-family', "'Pretendard', sans-serif"));

  // X axis labels
  g.append('g')
    .attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).tickSize(0))
    .call(gc => gc.select('.domain').remove())
    .call(gc => gc.selectAll('.tick text')
      .attr('fill', c.muted).attr('font-size', '9px')
      .attr('dy', '1.2em').attr('font-family', "'Pretendard', sans-serif"));

  // Bars
  g.selectAll('.bar')
    .data(weekData).enter()
    .append('rect')
    .attr('x',      d => x(d.label))
    .attr('y',      d => y(d.count))
    .attr('width',  x.bandwidth())
    .attr('height', d => ih - y(d.count))
    .attr('fill',   d => d.isCurrent ? c.primary : c.mint)
    .attr('rx', 4).attr('ry', 4);

  // Value labels
  g.selectAll('.bar-label')
    .data(weekData).enter()
    .append('text')
    .attr('x', d => x(d.label) + x.bandwidth() / 2)
    .attr('y', d => d.count > 0 ? y(d.count) - 4 : y(0) - 4)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('fill', c.muted)
    .attr('font-family', "'Pretendard', sans-serif")
    .text(d => d.count > 0 ? d.count : '');
}

// ==============================================
// DONUT CHART — 카테고리별 완료율
// ==============================================
function renderDonut(tasks) {
  const el = document.getElementById('chart-donut');
  if (!el) return;
  el.innerHTML = '';

  const c    = tv();
  const done = tasks.filter(t => t.status === 'done');

  const counts = {};
  done.forEach(t => {
    const k = t.category || 'none';
    counts[k] = (counts[k] || 0) + 1;
  });

  const data = Object.entries(counts)
    .map(([key, count]) => ({ key, count, label: CAT_NAMES[key] || key }))
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count);

  if (data.length === 0) {
    const p    = document.createElement('p');
    p.style.cssText = `font-size:13px;color:${c.muted};text-align:center;padding:36px 0;font-family:'Pretendard',sans-serif;`;
    p.textContent   = '완료한 할일이 없어요';
    el.appendChild(p);
    return;
  }

  const W    = el.clientWidth || 260;
  const size = Math.min(W, 180);
  const R    = size / 2 - 10;
  const Ri   = R * 0.56;

  const svg = d3.select(el).append('svg')
    .attr('width', '100%')
    .attr('viewBox', `0 0 ${W} ${size}`)
    .attr('role', 'img')
    .attr('aria-label', '카테고리별 완료율');

  const g = svg.append('g').attr('transform', `translate(${size / 2},${size / 2})`);

  const pie  = d3.pie().value(d => d.count).sort(null).padAngle(0.025);
  const arc  = d3.arc().innerRadius(Ri).outerRadius(R);
  const arcH = d3.arc().innerRadius(Ri).outerRadius(R + 6);

  const total = d3.sum(data, d => d.count);

  const numEl = g.append('text')
    .attr('text-anchor', 'middle').attr('y', -4)
    .attr('font-size', '24').attr('font-weight', '800')
    .attr('fill', c.title).attr('font-family', "'Pretendard', sans-serif")
    .text(total);

  const lblEl = g.append('text')
    .attr('text-anchor', 'middle').attr('y', 16)
    .attr('font-size', '11').attr('font-weight', '600')
    .attr('fill', c.muted).attr('font-family', "'Pretendard', sans-serif")
    .text('완료');

  g.selectAll('.slice')
    .data(pie(data)).enter()
    .append('path')
    .attr('d', arc)
    .attr('fill',         d => CAT_COLORS[d.data.key] || '#9CA3AF')
    .attr('stroke',       c.surface)
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).transition().duration(120).attr('d', arcH);
      numEl.text(d.data.count);
      lblEl.text(d.data.label);
    })
    .on('mouseleave', function() {
      d3.select(this).transition().duration(120).attr('d', arc);
      numEl.text(total);
      lblEl.text('완료');
    });

  // Legend (right of chart if space)
  if (W > size + 60) {
    const leg = svg.append('g')
      .attr('transform', `translate(${size + 8}, ${size / 2 - data.length * 11})`);
    data.forEach((d, i) => {
      const row = leg.append('g').attr('transform', `translate(0,${i * 22})`);
      row.append('rect').attr('width', 10).attr('height', 10).attr('rx', 2)
        .attr('fill', CAT_COLORS[d.key] || '#9CA3AF');
      row.append('text')
        .attr('x', 14).attr('y', 9)
        .attr('font-size', '11').attr('fill', c.muted)
        .attr('font-family', "'Pretendard', sans-serif")
        .text(`${d.label} ${d.count}`);
    });
  }
}

// ==============================================
// PUBLIC API
// ==============================================
function updateCharts(tasks) {
  renderHeatmap(tasks);
  renderWeekly(tasks);
  renderDonut(tasks);
}

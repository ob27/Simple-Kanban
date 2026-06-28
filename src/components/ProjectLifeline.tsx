import { useState } from 'react';
import { Popover, Button, InputNumber, Select } from 'antd';
import { EditOutlined } from '@ant-design/icons';

interface Props {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  onChangeDates: (startYear: number, startMonth: number, endYear: number, endMonth: number) => void;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_OPTIONS = MONTHS.map((label, value) => ({ value, label }));

function monthLabel(month: number) { return MONTHS[month] ?? ''; }

export function ProjectLifeline({ startYear, startMonth, endYear, endMonth, onChangeDates }: Props) {
  const [editing, setEditing] = useState(false);
  const [editSY, setEditSY] = useState(startYear);
  const [editSM, setEditSM] = useState(startMonth);
  const [editEY, setEditEY] = useState(endYear);
  const [editEM, setEditEM] = useState(endMonth);

  const today = new Date();
  const startDate = new Date(startYear, startMonth, 1);
  // First day of month after endMonth — so endMonth is fully included
  const endDate = new Date(endYear, endMonth + 1, 1);

  const totalMs = endDate.getTime() - startDate.getTime();
  const elapsedMs = today.getTime() - startDate.getTime();
  const pct = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));

  // Jan 1 tick marks for each year in range
  const yearTicks: { year: number; pct: number }[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const ms = new Date(y, 0, 1).getTime() - startDate.getTime();
    const p = (ms / totalMs) * 100;
    if (p >= 0 && p <= 100) yearTicks.push({ year: y, pct: p });
  }

  const todayLabel = today.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

  function handleConfirm() {
    // Validate: start must be before end
    const startTs = new Date(editSY, editSM, 1).getTime();
    const endTs = new Date(editEY, editEM, 1).getTime();
    if (startTs >= endTs) return; // silently ignore invalid range
    onChangeDates(editSY, editSM, editEY, editEM);
    setEditing(false);
  }

  const popoverContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 230 }}>
      {/* Start row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 34, fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Start</span>
        <Select
          value={editSM}
          onChange={v => setEditSM(v)}
          options={MONTH_OPTIONS}
          size="small"
          style={{ width: 76 }}
          popupMatchSelectWidth={false}
        />
        <InputNumber
          min={2000} max={9999}
          value={editSY}
          onChange={v => setEditSY(v ?? startYear)}
          size="small"
          style={{ width: 72 }}
          controls={false}
        />
      </div>

      {/* End row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 34, fontSize: 12, color: '#6B7280', fontWeight: 600 }}>End</span>
        <Select
          value={editEM}
          onChange={v => setEditEM(v)}
          options={MONTH_OPTIONS}
          size="small"
          style={{ width: 76 }}
          popupMatchSelectWidth={false}
        />
        <InputNumber
          min={2000} max={9999}
          value={editEY}
          onChange={v => setEditEY(v ?? endYear)}
          size="small"
          style={{ width: 72 }}
          controls={false}
        />
      </div>

      <Button type="primary" size="small" block onClick={handleConfirm}>Apply</Button>
    </div>
  );

  return (
    <div>
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 'clamp(10px, 0.75vw, 12px)', fontWeight: 600, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Project Lifeline
        </span>
        <Popover
          content={popoverContent}
          title="Configure project dates"
          trigger="click"
          open={editing}
          onOpenChange={open => {
            setEditing(open);
            if (open) {
              setEditSY(startYear); setEditSM(startMonth);
              setEditEY(endYear); setEditEM(endMonth);
            }
          }}
        >
          <EditOutlined style={{ fontSize: 11, color: '#9CA3AF', cursor: 'pointer' }} />
        </Popover>
        <span style={{ marginLeft: 'auto', fontSize: 'clamp(10px, 0.8vw, 12px)', color: '#6B7280', whiteSpace: 'nowrap' }}>
          <strong style={{ color: '#4F46E5' }}>{pct.toFixed(1)}%</strong> of project elapsed &nbsp;·&nbsp; Today: {todayLabel}
        </span>
      </div>

      {/* Bar */}
      <div style={{
        position: 'relative',
        height: 26,
        borderRadius: 8,
        background: '#E5E7EB',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
        overflow: 'visible',
      }}>
        {/* Elapsed fill */}
        <div style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: `${pct}%`,
          borderRadius: 8,
          background: 'linear-gradient(to right, #6366F1, #4F46E5)',
          transition: 'width 0.4s ease',
          overflow: 'hidden',
        }}>
          {yearTicks.filter(t => t.pct > 0).map(t => (
            <div key={`ft-${t.year}`} style={{
              position: 'absolute',
              left: `${(t.pct / pct) * 100}%`,
              top: '15%', bottom: '15%',
              width: 1,
              background: 'rgba(255,255,255,0.35)',
            }} />
          ))}
        </div>

        {/* Tick lines in unfilled zone */}
        {yearTicks.filter(t => t.pct > 0 && t.pct > pct).map(t => (
          <div key={`ut-${t.year}`} style={{
            position: 'absolute',
            left: `${t.pct}%`,
            top: '20%', bottom: '20%',
            width: 1,
            background: 'rgba(0,0,0,0.12)',
          }} />
        ))}

        {/* Today marker */}
        <div style={{
          position: 'absolute',
          left: `${pct}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#FFFFFF',
          border: '2px solid #4F46E5',
          borderRadius: 12,
          padding: '0 8px',
          fontSize: 'clamp(9px, 0.7vw, 11px)',
          fontWeight: 700,
          color: '#4F46E5',
          whiteSpace: 'nowrap',
          zIndex: 4,
          lineHeight: '18px',
          boxShadow: '0 1px 6px rgba(79,70,229,0.25)',
          pointerEvents: 'none',
        }}>
          Today
        </div>
      </div>

      {/* Year labels below */}
      <div style={{ position: 'relative', height: 15, marginTop: 3, overflow: 'visible' }}>
        {yearTicks.map((t, i) => (
          <span key={`yl-${t.year}`} style={{
            position: 'absolute',
            left: `${t.pct}%`,
            transform: i === 0 ? 'none' : 'translateX(-50%)',
            fontSize: 'clamp(9px, 0.7vw, 11px)',
            color: t.pct <= pct ? '#4B5563' : '#9CA3AF',
            fontWeight: t.year === today.getFullYear() ? 700 : 400,
            whiteSpace: 'nowrap',
          }}>
            {t.year}
          </span>
        ))}
        {/* End label — shows configured end month/year */}
        <span style={{
          position: 'absolute',
          right: 0,
          fontSize: 'clamp(9px, 0.7vw, 11px)',
          color: '#9CA3AF',
          whiteSpace: 'nowrap',
        }}>
          {monthLabel(endMonth)} {endYear}
        </span>
      </div>
    </div>
  );
}

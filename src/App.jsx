import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import * as XLSX from "xlsx";

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_GRADES = ["9°1","9°2","10°1","10°2"];

const CATEGORIES = {
  seguimiento: { label:"Seguimiento", short:"Seg", color:"#3b82f6", bg:"#dbeafe", text:"#1d4ed8", weight:0.30, desc:"Actividades regulares de seguimiento — 30%" },
  parcial:     { label:"Parcial",     short:"Par", color:"#8b5cf6", bg:"#ede9fe", text:"#6d28d9", weight:0.10, desc:"Evaluación parcial — 10%" },
  final:       { label:"Final",       short:"Fin", color:"#ec4899", bg:"#fce7f3", text:"#9d174d", weight:0.20, desc:"Evaluación final — 20%" },
  actitudinal: { label:"Actitudinal", short:"Act", color:"#f59e0b", bg:"#fef3c7", text:"#92400e", weight:0.20, desc:"Comportamiento y actitud — 20%" },
  aplicacion:  { label:"Aplicación",  short:"Apl", color:"#10b981", bg:"#d1fae5", text:"#065f46", weight:0.20, desc:"Actividad de aplicación — 20%" },
};
const CAT_KEYS = ["seguimiento","parcial","final","actitudinal","aplicacion"];
const TODAY = new Date().toISOString().slice(0,10);

// ─── Academic helpers ─────────────────────────────────────────────────────────
function getRange(n) {
  if (n === null || n === undefined || n === "" || isNaN(Number(n))) return null;
  const v = Number(n);
  if (v >= 4.6) return { label:"Superior", color:"#22c55e", bg:"#dcfce7", text:"#15803d" };
  if (v >= 4.0) return { label:"Alto",     color:"#3b82f6", bg:"#dbeafe", text:"#1d4ed8" };
  if (v >= 3.5) return { label:"Básico",   color:"#f59e0b", bg:"#fef3c7", text:"#92400e" };
  return             { label:"Bajo",     color:"#ef4444", bg:"#fee2e2", text:"#b91c1c" };
}

function mean(arr) {
  if (!arr || arr.length === 0) return null;
  return arr.reduce((a,b) => a+b, 0) / arr.length;
}

// Returns { seguimiento, parcial, final, actitudinal, aplicacion } — null if no scores
function getCatAvgs(sid, acts, scores) {
  const cs = {}; CAT_KEYS.forEach(c => { cs[c] = []; });
  acts.forEach(a => {
    const v = scores[`${a.id}||${sid}`];
    if (v !== undefined && v !== "" && v !== null && !isNaN(Number(v))) {
      cs[a.category].push(Number(v));
    }
  });
  const r = {};
  CAT_KEYS.forEach(c => { r[c] = cs[c].length > 0 ? mean(cs[c]) : null; });
  return r;
}

// Weighted average — normalized to categories that have scores
function getWeightedAvg(ca) {
  let ws = 0, wt = 0;
  CAT_KEYS.forEach(c => {
    if (ca[c] !== null) { ws += ca[c] * CATEGORIES[c].weight; wt += CATEGORIES[c].weight; }
  });
  return wt === 0 ? null : ws / wt;
}

// Pre-report = seguimiento(75%) + parcial(25%) among available
function getPreReport(ca) {
  const s = ca.seguimiento, p = ca.parcial;
  if (s === null && p === null) return null;
  if (s !== null && p !== null) return s * 0.75 + p * 0.25;
  return s !== null ? s : p;
}

function fmt(n, dec = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toFixed(dec);
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("es-ES", { day:"2-digit", month:"short" });
}

// ─── Storage ──────────────────────────────────────────────────────────────────
const load = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const defStudents   = gs => { const d={}; gs.forEach(g=>d[g]=[]); return d; };
const defActivities = gs => { const d={}; gs.forEach(g=>d[g]=[]); return d; };

// ─── New Activity Modal (2-step) ──────────────────────────────────────────────
function NewActivityModal({ onClose, onCreate }) {
  const [step, setStep]       = useState(1);
  const [category, setCat]    = useState(null);
  const [name, setName]       = useState("");
  const [date, setDate]       = useState(TODAY);

  const confirm = () => {
    if (!name.trim()) return;
    onCreate({ category, name: name.trim(), date });
    onClose();
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        {step === 1 ? (
          <>
            <div style={S.modalIcon}>📝</div>
            <h2 style={S.modalTitle}>Nueva Actividad</h2>
            <p style={{ fontSize:13, color:"#64748b", marginBottom:18, textAlign:"center" }}>
              Primero, selecciona la categoría:
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {CAT_KEYS.map(k => (
                <button key={k} onClick={() => { setCat(k); setStep(2); }}
                  style={{
                    display:"flex", alignItems:"center", gap:12, padding:"12px 16px",
                    borderRadius:12, border:`2px solid ${CATEGORIES[k].color}`,
                    background: CATEGORIES[k].bg, cursor:"pointer", textAlign:"left",
                    transition:"all 0.15s",
                  }}>
                  <span style={{ width:36, height:36, borderRadius:8, background:CATEGORIES[k].color, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:13, fontWeight:700, flexShrink:0 }}>
                    {(CATEGORIES[k].weight*100).toFixed(0)}%
                  </span>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14, color:CATEGORIES[k].text }}>{CATEGORIES[k].label}</div>
                    <div style={{ fontSize:11, color:"#64748b", marginTop:1 }}>{CATEGORIES[k].desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={onClose} style={{ ...S.btnSec, width:"100%", marginTop:14 }}>Cancelar</button>
          </>
        ) : (
          <>
            <button onClick={() => setStep(1)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:"#64748b", marginBottom:8, padding:0 }}>← Cambiar categoría</button>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, padding:"10px 14px", borderRadius:10, background:CATEGORIES[category].bg, border:`1.5px solid ${CATEGORIES[category].color}` }}>
              <span style={{ fontSize:22 }}>📌</span>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:CATEGORIES[category].text }}>{CATEGORIES[category].label}</div>
                <div style={{ fontSize:11, color:"#64748b" }}>{CATEGORIES[category].desc}</div>
              </div>
            </div>
            <label style={S.lbl}>Nombre de la actividad</label>
            <input autoFocus placeholder="Ej: Taller 1, Examen Parcial…" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key==="Enter" && confirm()}
              style={{ ...S.inp, marginBottom:12 }} />
            <label style={S.lbl}>Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...S.inp, marginBottom:18 }} />
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={onClose} style={{ ...S.btnSec, flex:1 }}>Cancelar</button>
              <button onClick={confirm} disabled={!name.trim()}
                style={{ ...S.btnPri, flex:2, opacity: name.trim() ? 1 : 0.5 }}>
                ✅ Crear actividad
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Alert Modal ──────────────────────────────────────────────────────────────
function AlertModal({ alert, onClose }) {
  if (!alert) return null;
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalIcon}>🚨</div>
        <h2 style={{ ...S.modalTitle, color:"#ef4444" }}>Alerta Académica</h2>
        <p style={{ fontWeight:700, fontSize:16, color:"#1e293b", textAlign:"center", margin:"4px 0 2px" }}>{alert.name}</p>
        <p style={{ fontSize:13, color:"#64748b", textAlign:"center", marginBottom:16 }}>{alert.grade}</p>
        <div style={{ background:"#fee2e2", borderRadius:12, padding:"12px 16px", marginBottom:14 }}>
          <strong style={{ color:"#b91c1c" }}>{alert.reason}</strong>
        </div>
        {alert.details && (
          <div style={{ marginBottom:16 }}>
            {alert.details.map((d,i) => (
              <div key={i} style={{ fontSize:12, color:"#475569", padding:"6px 10px", background:"#f8fafc", borderRadius:8, marginBottom:4 }}>{d}</div>
            ))}
          </div>
        )}
        <button onClick={onClose} style={{ ...S.btnPri, width:"100%", background:"linear-gradient(135deg,#ef4444,#dc2626)" }}>Entendido</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab]         = useState("notas");
  const [grades, setGrades]   = useState(() => load("nt-grades", DEFAULT_GRADES));
  const [students, setStudents] = useState(() => load("nt-students", defStudents(load("nt-grades", DEFAULT_GRADES))));
  const [activities, setActivities] = useState(() => load("nt-activities", defActivities(load("nt-grades", DEFAULT_GRADES))));
  const [scores, setScores]   = useState(() => load("nt-scores", {}));
  const [alertModal, setAlertModal] = useState(null);

  const saveGrades     = useCallback(g => { setGrades(g);     save("nt-grades",     g); }, []);
  const saveStudents   = useCallback(s => { setStudents(s);   save("nt-students",   s); }, []);
  const saveActivities = useCallback(a => { setActivities(a); save("nt-activities", a); }, []);
  const saveScores     = useCallback(s => { setScores(s);     save("nt-scores",     s); }, []);

  // Count global alerts for badge
  const alertCount = (() => {
    let n = 0;
    grades.forEach(g => {
      (students[g] || []).forEach(s => {
        const ca = getCatAvgs(s.id, activities[g] || [], scores);
        const pr = getPreReport(ca);
        const lowScores = (activities[g] || []).filter(a => {
          const v = scores[`${a.id}||${s.id}`];
          return v !== undefined && v !== "" && Number(v) < 3;
        }).length;
        if ((pr !== null && pr < 3.5) || lowScores >= 2) n++;
      });
    });
    return n;
  })();

  const tabs = [
    { id:"notas",       icon:"✏️", label:"Notas" },
    { id:"estudiantes", icon:"👥", label:"Estudiantes" },
    { id:"reporte",     icon:"📋", label:"Reporte" },
    { id:"graficas",    icon:"📊", label:"Gráficas" },
    { id:"alertas",     icon:"🚨", label:"Alertas", badge: alertCount },
  ];

  return (
    <div style={S.app}>
      <AlertModal alert={alertModal} onClose={() => setAlertModal(null)} />
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:30 }}>📓</span>
            <div>
              <div style={S.headerTitle}>Toma de Notas</div>
              <div style={S.headerSub}>Sistema de Registro Académico</div>
            </div>
          </div>
          <div style={S.headerDate}>
            📅 {new Date().toLocaleDateString("es-ES",{ weekday:"short", day:"numeric", month:"short", year:"numeric" })}
          </div>
        </div>
      </header>

      <nav style={S.nav}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ ...S.navBtn, ...(tab===t.id ? S.navActive : {}) }}>
            <span>{t.icon}</span>
            <span style={S.navLbl}>{t.label}</span>
            {t.badge > 0 && <span style={S.navBadge}>{t.badge}</span>}
          </button>
        ))}
      </nav>

      <main style={S.main}>
        {tab==="notas"       && <TabNotas       grades={grades} students={students} activities={activities} scores={scores} onScores={saveScores} onActivities={saveActivities} onAlert={setAlertModal} />}
        {tab==="estudiantes" && <TabEstudiantes grades={grades} students={students} activities={activities} onGrades={saveGrades} onStudents={saveStudents} onActivities={saveActivities} />}
        {tab==="reporte"     && <TabReporte     grades={grades} students={students} activities={activities} scores={scores} />}
        {tab==="graficas"    && <TabGraficas    grades={grades} students={students} activities={activities} scores={scores} />}
        {tab==="alertas"     && <TabAlertas     grades={grades} students={students} activities={activities} scores={scores} onAlert={setAlertModal} />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: NOTAS
// ═══════════════════════════════════════════════════════════════════════════════
function TabNotas({ grades, students, activities, scores, onScores, onActivities, onAlert }) {
  const [grade, setGrade]         = useState(grades[0] || "");
  const [selectedAct, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast]         = useState("");

  const gradeActs = activities[grade] || [];
  const gradeStudents = students[grade] || [];
  const act = gradeActs.find(a => a.id === selectedAct) || null;

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const createActivity = ({ category, name, date }) => {
    const id = `act-${Date.now()}`;
    const newActs = { ...activities, [grade]: [...gradeActs, { id, name, category, date }] };
    onActivities(newActs);
    setSelected(id);
    showToast(`✅ Actividad "${name}" creada`);
  };

  const deleteActivity = (id) => {
    const newActs = { ...activities, [grade]: gradeActs.filter(a => a.id !== id) };
    const newScores = { ...scores };
    (students[grade] || []).forEach(s => delete newScores[`${id}||${s.id}`]);
    onActivities(newActs);
    onScores(newScores);
    if (selectedAct === id) setSelected(null);
    showToast("🗑️ Actividad eliminada");
  };

  const setScore = (actId, studentId, val, studentName) => {
    const key = `${actId}||${studentId}`;
    const newScores = { ...scores, [key]: val === "" ? "" : val };
    onScores(newScores);

    // Check alert: 2+ scores below 3 for this student
    if (val !== "" && Number(val) < 3) {
      const studentActs = activities[grade] || [];
      const lowCount = studentActs.filter(a => {
        const v = a.id === actId ? val : scores[`${a.id}||${studentId}`];
        return v !== undefined && v !== "" && Number(v) < 3;
      }).length;
      if (lowCount >= 2) {
        const details = studentActs
          .filter(a => {
            const v = a.id === actId ? val : scores[`${a.id}||${studentId}`];
            return v !== undefined && v !== "" && Number(v) < 3;
          })
          .map(a => `${a.name} (${CATEGORIES[a.category].label}): ${a.id === actId ? val : scores[`${a.id}||${studentId}`]}`);
        onAlert({
          name: studentName, grade,
          reason: `${lowCount} notas por debajo de 3.0 — requiere atención urgente`,
          details,
        });
      }
    }
  };

  // Scores entered count for an activity
  const scoreCount = (actId) => gradeStudents.filter(s => {
    const v = scores[`${actId}||${s.id}`];
    return v !== undefined && v !== "";
  }).length;

  return (
    <div style={S.tabContent}>
      {toast && <div style={S.toast}>{toast}</div>}
      {showModal && <NewActivityModal onClose={() => setShowModal(false)} onCreate={createActivity} />}

      {/* Grade selector */}
      <div style={S.card}>
        <label style={S.lbl}>Grado</label>
        <select value={grade} onChange={e => { setGrade(e.target.value); setSelected(null); }} style={S.sel}>
          {grades.map(g => <option key={g}>{g}</option>)}
        </select>
      </div>

      {/* Activities strip */}
      <div style={S.card}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <span style={S.cardTitle}>📚 Actividades — {grade}</span>
          <button onClick={() => setShowModal(true)} style={S.btnPri}>➕ Nueva</button>
        </div>

        {gradeActs.length === 0 ? (
          <p style={S.empty}>Sin actividades. Crea la primera tocando ➕ Nueva.</p>
        ) : (
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {gradeActs.map(a => {
              const cat = CATEGORIES[a.category];
              const isSelected = selectedAct === a.id;
              const sc = scoreCount(a.id);
              return (
                <div key={a.id} style={{
                  display:"flex", alignItems:"center", gap:0,
                  borderRadius:24, overflow:"hidden",
                  border:`2px solid ${isSelected ? cat.color : "#e2e8f0"}`,
                  cursor:"pointer", transition:"all 0.15s",
                  boxShadow: isSelected ? `0 4px 14px ${cat.color}44` : "none",
                }}>
                  <div onClick={() => setSelected(isSelected ? null : a.id)}
                    style={{
                      display:"flex", alignItems:"center", gap:8, padding:"7px 12px",
                      background: isSelected ? cat.color : cat.bg,
                      color: isSelected ? "#fff" : cat.text,
                    }}>
                    <span style={{ fontSize:11, fontWeight:700 }}>{cat.short}</span>
                    <span style={{ fontSize:13, fontWeight:500 }}>{a.name}</span>
                    <span style={{ fontSize:10, opacity:0.7 }}>{fmtDate(a.date)}</span>
                    <span style={{ fontSize:10, background:"rgba(255,255,255,0.3)", padding:"1px 6px", borderRadius:10 }}>
                      {sc}/{gradeStudents.length}
                    </span>
                  </div>
                  <button onClick={() => deleteActivity(a.id)}
                    style={{ padding:"7px 10px", background: isSelected ? cat.color : "#f8fafc", border:"none", cursor:"pointer", color: isSelected ? "rgba(255,255,255,0.7)" : "#94a3b8", fontSize:12, borderLeft:`1px solid ${isSelected ? "rgba(255,255,255,0.2)" : "#e2e8f0"}` }}>
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Score entry */}
      {act && (
        <div style={S.card}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, padding:"10px 14px", borderRadius:10, background:CATEGORIES[act.category].bg, border:`1.5px solid ${CATEGORIES[act.category].color}` }}>
            <span style={{ fontSize:20 }}>📌</span>
            <div style={{ flex:1 }}>
              <span style={{ fontWeight:700, color:CATEGORIES[act.category].text }}>{act.name}</span>
              <span style={{ fontSize:12, color:"#64748b", marginLeft:8 }}>{CATEGORIES[act.category].label} · {fmtDate(act.date)} · Peso {(CATEGORIES[act.category].weight*100).toFixed(0)}%</span>
            </div>
            <span style={{ fontSize:13, color:"#64748b" }}>{scoreCount(act.id)}/{gradeStudents.length} registradas</span>
          </div>

          {gradeStudents.length === 0 ? (
            <p style={S.empty}>No hay estudiantes en este grado.</p>
          ) : gradeStudents.map((s, i) => {
            const rawVal = scores[`${act.id}||${s.id}`];
            const val = rawVal !== undefined ? rawVal : "";
            const range = val !== "" ? getRange(Number(val)) : null;
            return (
              <div key={s.id} style={{ ...S.sRow, background: i%2===0?"#fafafa":"#fff", borderLeft:`4px solid ${range ? range.color : "transparent"}` }}>
                <span style={S.sNum}>{i+1}</span>
                <span style={{ ...S.sName, flex:1 }}>{s.name}</span>
                <input
                  type="number" min="0" max="5" step="0.1"
                  value={val}
                  onChange={e => setScore(act.id, s.id, e.target.value, s.name)}
                  placeholder="0.0"
                  style={{
                    width:68, padding:"7px 8px", borderRadius:8, textAlign:"center",
                    border:`2px solid ${range ? range.color : "#e2e8f0"}`,
                    fontSize:15, fontWeight:700, outline:"none",
                    background: range ? range.bg : "#fff",
                    color: range ? range.text : "#94a3b8",
                  }}
                />
                {range && (
                  <span style={{ ...S.badge, background:range.bg, color:range.text, minWidth:66 }}>
                    {range.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: ESTUDIANTES
// ═══════════════════════════════════════════════════════════════════════════════
function TabEstudiantes({ grades, students, activities, onGrades, onStudents, onActivities }) {
  const [grade, setGrade]   = useState(grades[0] || "");
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [toast, setToast]   = useState("");
  const [importing, setImporting] = useState(false);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 2500); };
  const list     = students[grade] || [];
  const filtered = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const addStudent = () => {
    const name = newName.trim(); if (!name) return;
    onStudents({ ...students, [grade]: [...list, { id:`st-${Date.now()}`, name }] });
    setNewName(""); showToast(`✅ "${name}" agregado`);
  };

  const removeStudent = id => onStudents({ ...students, [grade]: list.filter(s => s.id !== id) });

  const addGrade = () => {
    const name = newGrade.trim();
    if (!name || grades.some(g => g.toLowerCase()===name.toLowerCase())) { showToast("⚠️ Ya existe o está vacío"); return; }
    const ng = [...grades, name];
    onGrades(ng);
    onStudents({ ...students, [name]: [] });
    onActivities({ ...activities, [name]: [] });
    setGrade(name); setNewGrade(""); showToast(`✅ Grado "${name}" creado`);
  };

  const deleteGrade = g => {
    if ((students[g]||[]).length > 0) { setConfirmDel(g); return; }
    doDeleteGrade(g);
  };

  const doDeleteGrade = g => {
    const ng = grades.filter(x => x!==g);
    const ns = { ...students }; delete ns[g];
    const na = { ...activities }; delete na[g];
    onGrades(ng); onStudents(ns); onActivities(na);
    setGrade(ng[0]||""); setConfirmDel(null); showToast(`🗑️ Grado "${g}" eliminado`);
  };

  const handleImport = e => {
    const file = e.target.files[0]; if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const wb = XLSX.read(evt.target.result, { type:"binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header:1 });
        const hdrs = data[0]?.map(h => String(h).toLowerCase().trim()) || [];
        const ni = hdrs.findIndex(h => h.includes("nombre")||h.includes("name"));
        const gi = hdrs.findIndex(h => h.includes("grado")||h.includes("grade"));
        if (ni===-1) { showToast("❌ No se encontró columna 'Nombre'"); setImporting(false); return; }
        const ns = { ...students }; let count=0, skip=0;
        data.slice(1).forEach(row => {
          const name = String(row[ni]||"").trim(); if (!name) return;
          const tg   = gi!==-1 ? String(row[gi]||"").trim() : grade;
          const mg   = grades.find(g => g.toLowerCase()===tg.toLowerCase()) || grade;
          if (!ns[mg]) ns[mg]=[];
          if (ns[mg].some(s => s.name.toLowerCase()===name.toLowerCase())) { skip++; return; }
          ns[mg] = [...ns[mg], { id:`st-${Date.now()}-${count}`, name }]; count++;
        });
        onStudents(ns); showToast(`✅ ${count} importados${skip>0?`, ${skip} omitidos`:""}`);
      } catch { showToast("❌ Error al leer el archivo"); }
      setImporting(false); e.target.value="";
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([["Nombre","Grado"],["Juan Pérez","9°1"],["María López","10°2"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estudiantes");
    XLSX.writeFile(wb, "plantilla_estudiantes.xlsx");
    showToast("📥 Plantilla descargada");
  };

  return (
    <div style={S.tabContent}>
      {toast && <div style={S.toast}>{toast}</div>}

      {/* Confirm delete grade modal */}
      {confirmDel && (
        <div style={S.overlay} onClick={() => setConfirmDel(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalIcon}>⚠️</div>
            <h2 style={{ ...S.modalTitle, color:"#f59e0b", fontSize:17 }}>¿Eliminar grado?</h2>
            <p style={{ fontSize:13, color:"#475569", marginBottom:8, textAlign:"center" }}>
              <b>"{confirmDel}"</b> tiene <b>{(students[confirmDel]||[]).length} estudiantes</b> y {(activities[confirmDel]||[]).length} actividades. Todo será eliminado.
            </p>
            <div style={{ display:"flex", gap:8, marginTop:12 }}>
              <button onClick={() => setConfirmDel(null)} style={{ ...S.btnSec, flex:1 }}>Cancelar</button>
              <button onClick={() => doDeleteGrade(confirmDel)} style={{ ...S.btnPri, flex:1, background:"linear-gradient(135deg,#ef4444,#dc2626)" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Grade management */}
      <div style={{ ...S.card, background:"linear-gradient(135deg,#faf5ff,#f3e8ff)", border:"1.5px solid #e9d5ff" }}>
        <div style={S.cardTitle}>🎓 Gestión de Grados</div>
        <div style={{ ...S.row, marginTop:10, marginBottom:14 }}>
          <input placeholder="Nuevo grado (ej: 11°1, Bachillerato A…)" value={newGrade}
            onChange={e => setNewGrade(e.target.value)}
            onKeyDown={e => e.key==="Enter" && addGrade()}
            style={{ ...S.inp, flex:1, borderColor:"#d8b4fe" }} />
          <button onClick={addGrade} style={{ ...S.btnPri, background:"linear-gradient(135deg,#9333ea,#7c3aed)", whiteSpace:"nowrap" }}>➕ Agregar</button>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
          {grades.map(g => (
            <div key={g} style={{
              display:"flex", alignItems:"center", gap:6, padding:"5px 6px 5px 13px",
              borderRadius:20, border:`1.5px solid ${g===grade?"#9333ea":"#d8b4fe"}`,
              background: g===grade ? "#9333ea" : "#fff", cursor:"pointer",
              fontSize:13, fontWeight:500, color: g===grade?"#fff":"#6b21a8",
              transition:"all 0.15s",
            }} onClick={() => setGrade(g)}>
              {g}
              <button onClick={e=>{ e.stopPropagation(); deleteGrade(g); }}
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, padding:"0 3px", color: g===grade?"rgba(255,255,255,0.7)":"#9333ea", lineHeight:1 }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Import */}
      <div style={{ ...S.card, background:"linear-gradient(135deg,#f0f9ff,#e0f2fe)", border:"1.5px solid #bae6fd" }}>
        <div style={S.cardTitle}>📥 Importar desde Excel</div>
        <p style={{ fontSize:13, color:"#475569", margin:"6px 0 12px" }}>Columnas: <b>Nombre</b> y <b>Grado</b></p>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <label style={{ ...S.btnPri, display:"inline-block", cursor:"pointer" }}>
            {importing?"⏳ Procesando…":"📂 Seleccionar archivo"}
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} style={{ display:"none" }} />
          </label>
          <button onClick={downloadTemplate} style={S.btnSec}>📋 Plantilla</button>
        </div>
      </div>

      {/* Student list */}
      <div style={S.card}>
        <div style={S.row}>
          <div style={{ flex:1 }}>
            <label style={S.lbl}>Grado activo</label>
            <select value={grade} onChange={e=>{ setGrade(e.target.value); setSearch(""); }} style={S.sel}>
              {grades.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ flex:2 }}>
            <label style={S.lbl}>Buscar</label>
            <input placeholder="Buscar estudiante…" value={search} onChange={e=>setSearch(e.target.value)} style={S.inp} />
          </div>
        </div>
        <div style={{ ...S.row, marginTop:10 }}>
          <input placeholder="Nombre del nuevo estudiante…" value={newName}
            onChange={e=>setNewName(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addStudent()}
            style={{ ...S.inp, flex:1 }} />
          <button onClick={addStudent} style={S.btnPri}>➕ Agregar</button>
        </div>
        <div style={{ marginTop:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <span style={S.cardTitle}>👥 {grade}</span>
            <span style={{ fontSize:13, color:"#94a3b8" }}>{list.length} estudiantes</span>
          </div>
          {filtered.length === 0 ? (
            <p style={S.empty}>{search?"Sin resultados.":"No hay estudiantes."}</p>
          ) : filtered.map((s,i) => (
            <div key={s.id} style={{ ...S.sRow, background:i%2===0?"#fafafa":"#fff", borderLeft:"4px solid transparent" }}>
              <span style={S.sNum}>{i+1}</span>
              <span style={{ ...S.sName, flex:1 }}>{s.name}</span>
              <button onClick={()=>removeStudent(s.id)} style={S.delBtn}>🗑️</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: REPORTE
// ═══════════════════════════════════════════════════════════════════════════════
function TabReporte({ grades, students, activities, scores }) {
  const [grade, setGrade] = useState(grades[0] || "");
  const [view, setView]   = useState("resumen"); // "resumen" | "preinforme"

  const list = students[grade] || [];
  const acts = activities[grade] || [];

  const studentStats = list.map(s => {
    const ca  = getCatAvgs(s.id, acts, scores);
    const wav = getWeightedAvg(ca);
    const pre = getPreReport(ca);
    const lowScores = acts.filter(a => {
      const v = scores[`${a.id}||${s.id}`]; return v!==undefined&&v!==""&&Number(v)<3;
    });
    return { ...s, ca, wav, pre, lowScores };
  });

  // Group activities by category for column headers
  const actsByCat = {};
  CAT_KEYS.forEach(c => { actsByCat[c] = acts.filter(a => a.category === c); });

  const exportReport = () => {
    const rows = studentStats.map(s => {
      const row = { "Estudiante": s.name, "Grado": grade };
      CAT_KEYS.forEach(c => {
        row[`${CATEGORIES[c].label} (${(CATEGORIES[c].weight*100).toFixed(0)}%)`] = s.ca[c] !== null ? fmt(s.ca[c]) : "Sin notas";
      });
      row["Promedio Final"] = fmt(s.wav);
      row["Nivel"]    = s.wav !== null ? getRange(s.wav)?.label : "—";
      row["Pre-Informe"] = fmt(s.pre);
      row["Alerta Pre-Inf"] = (s.pre !== null && s.pre < 3.5) ? "⚠️ Bajo" : "";
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `reporte_${grade.replace(/[°\s]/g,"")}.xlsx`);
  };

  return (
    <div style={S.tabContent}>
      <div style={S.card}>
        <div style={S.row}>
          <div style={{ flex:1 }}>
            <label style={S.lbl}>Grado</label>
            <select value={grade} onChange={e => setGrade(e.target.value)} style={S.sel}>
              {grades.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
            <label style={S.lbl}>Vista</label>
            <div style={{ display:"flex", gap:6 }}>
              {["resumen","preinforme"].map(v => (
                <button key={v} onClick={()=>setView(v)}
                  style={{ ...S.toggleBtn, ...(view===v?S.toggleActive:{}) }}>
                  {v==="resumen"?"Resumen":"Pre-Informe"}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Category weight legend */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:12 }}>
          {CAT_KEYS.map(c => (
            <span key={c} style={{ ...S.badge, background:CATEGORIES[c].bg, color:CATEGORIES[c].text, fontSize:11 }}>
              {CATEGORIES[c].label} {(CATEGORIES[c].weight*100).toFixed(0)}%
            </span>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <span style={S.cardTitle}>
            {view==="resumen" ? "📋 Notas por Categoría" : "📄 Pre-Informe"}
          </span>
          <button onClick={exportReport} style={S.btnSec}>📥 Excel</button>
        </div>

        {list.length === 0 ? <p style={S.empty}>No hay estudiantes en este grado.</p> : (
          <div style={{ overflowX:"auto" }}>
            {view === "resumen" ? (
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, textAlign:"left" }}>#</th>
                    <th style={{ ...S.th, textAlign:"left" }}>Estudiante</th>
                    {CAT_KEYS.map(c => (
                      <th key={c} style={{ ...S.th, color:CATEGORIES[c].text, background:CATEGORIES[c].bg, whiteSpace:"nowrap" }}>
                        {CATEGORIES[c].short}<br/><span style={{ fontSize:9, fontWeight:400 }}>{(CATEGORIES[c].weight*100).toFixed(0)}%</span>
                      </th>
                    ))}
                    <th style={S.th}>Final</th>
                    <th style={S.th}>Nivel</th>
                  </tr>
                </thead>
                <tbody>
                  {studentStats.map((s,i) => {
                    const rng = s.wav !== null ? getRange(s.wav) : null;
                    return (
                      <tr key={s.id} style={{ background:i%2===0?"#fafafa":"#fff" }}>
                        <td style={S.td}>{i+1}</td>
                        <td style={{ ...S.td, textAlign:"left", fontWeight:500 }}>{s.name}</td>
                        {CAT_KEYS.map(c => {
                          const v = s.ca[c];
                          const r = v !== null ? getRange(v) : null;
                          return (
                            <td key={c} style={{ ...S.td }}>
                              {v !== null ? (
                                <span style={{ fontWeight:700, color: r?.text || "#64748b" }}>{fmt(v)}</span>
                              ) : <span style={{ color:"#cbd5e1", fontSize:12 }}>—</span>}
                            </td>
                          );
                        })}
                        <td style={S.td}>
                          <span style={{ fontWeight:800, fontSize:15, color:rng?.text||"#94a3b8" }}>{fmt(s.wav)}</span>
                        </td>
                        <td style={S.td}>
                          {rng && <span style={{ ...S.badge, background:rng.bg, color:rng.text, fontSize:11 }}>{rng.label}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* Pre-informe view */
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, textAlign:"left" }}>#</th>
                    <th style={{ ...S.th, textAlign:"left" }}>Estudiante</th>
                    <th style={{ ...S.th, background:"#dbeafe", color:"#1d4ed8" }}>Seg. Prom<br/><span style={{ fontSize:9 }}>75%</span></th>
                    <th style={{ ...S.th, background:"#ede9fe", color:"#6d28d9" }}>Parcial<br/><span style={{ fontSize:9 }}>25%</span></th>
                    <th style={S.th}>Pre-Informe</th>
                    <th style={S.th}>Estado</th>
                    <th style={S.th}>Notas &lt;3</th>
                  </tr>
                </thead>
                <tbody>
                  {studentStats.map((s,i) => {
                    const pre = s.pre;
                    const alert = pre !== null && pre < 3.5;
                    const rng = pre !== null ? getRange(pre) : null;
                    return (
                      <tr key={s.id} style={{ background: alert?"#fff5f5": i%2===0?"#fafafa":"#fff" }}>
                        <td style={S.td}>{i+1}</td>
                        <td style={{ ...S.td, textAlign:"left", fontWeight:500 }}>{s.name}</td>
                        <td style={{ ...S.td, color:"#1d4ed8", fontWeight:600 }}>{fmt(s.ca.seguimiento)}</td>
                        <td style={{ ...S.td, color:"#6d28d9", fontWeight:600 }}>{fmt(s.ca.parcial)}</td>
                        <td style={S.td}>
                          <span style={{ fontWeight:800, fontSize:15, color:rng?.text||"#94a3b8" }}>{fmt(pre)}</span>
                        </td>
                        <td style={S.td}>
                          {alert
                            ? <span style={{ ...S.badge, background:"#fee2e2", color:"#b91c1c", fontSize:11 }}>⚠️ Bajo 3.5</span>
                            : pre !== null ? <span style={{ ...S.badge, background:"#dcfce7", color:"#15803d", fontSize:11 }}>✅ OK</span>
                            : <span style={{ color:"#cbd5e1", fontSize:12 }}>—</span>}
                        </td>
                        <td style={S.td}>
                          {s.lowScores.length >= 2
                            ? <span style={{ ...S.badge, background:"#fee2e2", color:"#b91c1c", fontSize:11 }}>🚨 {s.lowScores.length}</span>
                            : s.lowScores.length === 1
                            ? <span style={{ ...S.badge, background:"#fef3c7", color:"#92400e", fontSize:11 }}>⚠️ 1</span>
                            : <span style={{ color:"#22c55e", fontSize:13 }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: GRÁFICAS
// ═══════════════════════════════════════════════════════════════════════════════
function TabGraficas({ grades, students, activities, scores }) {
  const [grade, setGrade] = useState(grades[0] || "");
  const [type,  setType]  = useState("bar"); // "bar" | "pie" | "cat"
  const [cat,   setCat]   = useState("seguimiento");

  const list = students[grade] || [];
  const acts = activities[grade] || [];

  const studentStats = list.map(s => {
    const ca  = getCatAvgs(s.id, acts, scores);
    const wav = getWeightedAvg(ca);
    return { name:s.name.split(" ")[0], fullName:s.name, ca, wav };
  });

  // Bar chart data: weighted average per student
  const barData = studentStats.map(s => ({
    name: s.name,
    promedio: s.wav !== null ? parseFloat(s.wav.toFixed(2)) : null,
    fill: s.wav !== null ? getRange(s.wav)?.color : "#cbd5e1",
  }));

  // Category bar data
  const catBarData = studentStats.map(s => ({
    name: s.name,
    nota: s.ca[cat] !== null ? parseFloat(s.ca[cat].toFixed(2)) : null,
    fill: s.ca[cat] !== null ? getRange(s.ca[cat])?.color : "#cbd5e1",
  }));

  // Pie data: range distribution
  const rangeCounts = { Superior:0, Alto:0, Básico:0, Bajo:0, "Sin notas":0 };
  studentStats.forEach(s => {
    if (s.wav === null) rangeCounts["Sin notas"]++;
    else rangeCounts[getRange(s.wav)?.label]++;
  });
  const pieData = [
    { name:"Superior", value:rangeCounts.Superior, color:"#22c55e" },
    { name:"Alto",     value:rangeCounts.Alto,     color:"#3b82f6" },
    { name:"Básico",   value:rangeCounts.Básico,   color:"#f59e0b" },
    { name:"Bajo",     value:rangeCounts.Bajo,     color:"#ef4444" },
  ].filter(d => d.value > 0);

  return (
    <div style={S.tabContent}>
      <div style={S.card}>
        <div style={S.row}>
          <div style={{ flex:1 }}>
            <label style={S.lbl}>Grado</label>
            <select value={grade} onChange={e => setGrade(e.target.value)} style={S.sel}>
              {grades.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ flex:2 }}>
            <label style={S.lbl}>Vista</label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {[["bar","Promedio Final"],["pie","Distribución"],["cat","Por Categoría"]].map(([v,l]) => (
                <button key={v} onClick={()=>setType(v)}
                  style={{ ...S.toggleBtn, ...(type===v?S.toggleActive:{}) }}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        {type === "cat" && (
          <div style={{ marginTop:10 }}>
            <label style={S.lbl}>Categoría</label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {CAT_KEYS.map(c => (
                <button key={c} onClick={()=>setCat(c)}
                  style={{ ...S.toggleBtn, ...(cat===c?{ background:CATEGORIES[c].color, color:"#fff", borderColor:CATEGORIES[c].color }:{}) }}>
                  {CATEGORIES[c].label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10 }}>
        {[
          { l:"Superior", c:"#22c55e", v:rangeCounts.Superior },
          { l:"Alto",     c:"#3b82f6", v:rangeCounts.Alto },
          { l:"Básico",   c:"#f59e0b", v:rangeCounts.Básico },
          { l:"Bajo",     c:"#ef4444", v:rangeCounts.Bajo },
        ].map(r => (
          <div key={r.l} style={{ background:"#fff", borderRadius:12, padding:"14px", textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.05)", border:"1px solid #e8edf2", borderTop:`4px solid ${r.c}` }}>
            <div style={{ fontSize:28, fontWeight:800, color:r.c }}>{r.v}</div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:3 }}>{r.l}</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>
          {type==="bar"?"📊 Promedio Final por Estudiante":type==="pie"?"🥧 Distribución por Nivel":"📊 "+CATEGORIES[cat]?.label+" por Estudiante"}
        </div>
        <div style={{ marginTop:16, fontSize:11, color:"#94a3b8", marginBottom:8 }}>
          Rangos: Bajo &lt;3.5 · Básico [3.5–4) · Alto [4–4.6) · Superior [4.6–5]
        </div>

        {type !== "pie" ? (
          (type==="bar"?barData:catBarData).every(d => d.promedio===null && d.nota===null) ? (
            <p style={S.empty}>Sin datos suficientes para graficar.</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={type==="bar"?barData:catBarData} margin={{ top:10, right:10, bottom:60, left:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize:11 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis domain={[0,5]} ticks={[0,1,2,3,3.5,4,4.6,5]} tick={{ fontSize:10 }} />
                <Tooltip formatter={v => [v?.toFixed(2), "Nota"]} />
                <ReferenceLine y={3.5} stroke="#f59e0b" strokeDasharray="4 4" label={{ value:"3.5", fill:"#f59e0b", fontSize:10 }} />
                <ReferenceLine y={4.0} stroke="#3b82f6" strokeDasharray="4 4" label={{ value:"4.0", fill:"#3b82f6", fontSize:10 }} />
                <ReferenceLine y={4.6} stroke="#22c55e" strokeDasharray="4 4" label={{ value:"4.6", fill:"#22c55e", fontSize:10 }} />
                <Bar dataKey={type==="bar"?"promedio":"nota"} name="Nota" radius={[5,5,0,0]}>
                  {(type==="bar"?barData:catBarData).map((entry,i) => (
                    <Cell key={i} fill={entry.fill || "#cbd5e1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )
        ) : (
          pieData.length === 0 ? <p style={S.empty}>Sin datos.</p> : (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110}
                  label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {pieData.map((e,i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          )
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: ALERTAS
// ═══════════════════════════════════════════════════════════════════════════════
function TabAlertas({ grades, students, activities, scores, onAlert }) {
  const [grade, setGrade] = useState("all");

  const gradesToScan = grade === "all" ? grades : [grade];

  const preAlerts  = []; // pre-report < 3.5
  const lowAlerts  = []; // 2+ individual scores < 3

  gradesToScan.forEach(g => {
    const acts = activities[g] || [];
    (students[g] || []).forEach(s => {
      const ca  = getCatAvgs(s.id, acts, scores);
      const pre = getPreReport(ca);

      // Pre-report alert
      if (pre !== null && pre < 3.5) {
        preAlerts.push({ ...s, grade:g, pre, ca });
      }

      // Low scores alert
      const lowActs = acts.filter(a => {
        const v = scores[`${a.id}||${s.id}`]; return v!==undefined&&v!==""&&Number(v)<3;
      });
      if (lowActs.length >= 2) {
        lowAlerts.push({ ...s, grade:g, lowActs });
      }
    });
  });

  return (
    <div style={S.tabContent}>
      {/* Header */}
      <div style={{ ...S.card, background:"linear-gradient(135deg,#1e1b4b,#312e81)", color:"#fff" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:34 }}>🚨</span>
          <div>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:800 }}>Monitor de Alertas Académicas</div>
            <div style={{ fontSize:12, opacity:0.7, marginTop:4 }}>Pre-informe bajo 3.5 · Dos o más notas bajo 3.0</div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div style={S.card}>
        <label style={S.lbl}>Filtrar por grado</label>
        <select value={grade} onChange={e => setGrade(e.target.value)} style={S.sel}>
          <option value="all">— Todos los grados —</option>
          {grades.map(g => <option key={g}>{g}</option>)}
        </select>
      </div>

      {/* Empty */}
      {preAlerts.length === 0 && lowAlerts.length === 0 && (
        <div style={{ ...S.card, textAlign:"center", padding:48 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
          <div style={{ fontSize:16, fontWeight:700, color:"#1e293b" }}>Sin alertas activas</div>
          <div style={{ fontSize:13, color:"#94a3b8", marginTop:6 }}>Todos los estudiantes están dentro de los rangos esperados</div>
        </div>
      )}

      {/* Pre-report alerts */}
      {preAlerts.length > 0 && (
        <div style={S.card}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <div>
              <div style={{ ...S.cardTitle, color:"#b45309" }}>⚠️ Pre-Informe bajo 3.5 — {preAlerts.length} estudiante{preAlerts.length>1?"s":""}</div>
              <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>Promedio de seguimiento + parcial por debajo del mínimo</div>
            </div>
          </div>
          {preAlerts.map((s,i) => {
            const rng = getRange(s.pre);
            return (
              <div key={s.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 10px", borderRadius:10, marginBottom:6, background:i%2===0?"#fffbeb":"#fff", border:"1px solid #fde68a" }}
                onClick={() => onAlert({ name:s.name, grade:s.grade, reason:`Pre-informe: ${fmt(s.pre)} — Por debajo de 3.5`, details:[`Promedio seguimiento: ${fmt(s.ca.seguimiento)}`,`Parcial: ${fmt(s.ca.parcial)}`,`Pre-informe calculado: ${fmt(s.pre)}`] })}
                style={{ cursor:"pointer" }}>
                <div style={{ fontSize:26, flexShrink:0 }}>⚠️</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:"#1e293b" }}>{s.name}</div>
                  <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>{s.grade} · Seg: {fmt(s.ca.seguimiento)} · Parcial: {fmt(s.ca.parcial)}</div>
                </div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:26, fontWeight:900, color:rng?.color||"#f59e0b", lineHeight:1 }}>{fmt(s.pre)}</div>
                  <div style={{ fontSize:10, color:"#94a3b8" }}>pre-inf.</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Low score alerts */}
      {lowAlerts.length > 0 && (
        <div style={S.card}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <div>
              <div style={{ ...S.cardTitle, color:"#b91c1c" }}>🚨 Notas críticas — {lowAlerts.length} estudiante{lowAlerts.length>1?"s":""}</div>
              <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>2 o más notas individuales por debajo de 3.0</div>
            </div>
          </div>
          {lowAlerts.map((s,i) => (
            <div key={s.id} style={{ padding:"12px 10px", borderRadius:10, marginBottom:6, background:i%2===0?"#fff5f5":"#fff", border:"1px solid #fecaca", cursor:"pointer" }}
              onClick={() => onAlert({ name:s.name, grade:s.grade, reason:`${s.lowActs.length} notas por debajo de 3.0`, details:s.lowActs.map(a=>`${a.name} (${CATEGORIES[a.category].label}): ${fmt(scores[`${a.id}||${s.id}`])}`) })}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ fontSize:26 }}>🚨</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:"#1e293b" }}>{s.name}</div>
                  <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>{s.grade}</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
                    {s.lowActs.map(a => (
                      <span key={a.id} style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:10, background:CATEGORIES[a.category].bg, color:CATEGORIES[a.category].text }}>
                        {a.name}: <span style={{ color:"#ef4444" }}>{fmt(scores[`${a.id}||${s.id}`])}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:28, fontWeight:900, color:"#ef4444", lineHeight:1 }}>{s.lowActs.length}</div>
                  <div style={{ fontSize:10, color:"#94a3b8" }}>críticas</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  app: { minHeight:"100vh", background:"#f0f4f8", paddingBottom:28 },
  header: { background:"linear-gradient(135deg,#1e1b4b 0%,#312e81 100%)", color:"#fff", padding:"14px 20px", boxShadow:"0 4px 20px rgba(0,0,0,0.25)" },
  headerInner: { display:"flex", alignItems:"center", justifyContent:"space-between", maxWidth:960, margin:"0 auto", flexWrap:"wrap", gap:10 },
  headerTitle: { fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:800 },
  headerSub: { fontSize:11, opacity:0.6, marginTop:2 },
  headerDate: { fontSize:12, opacity:0.8, background:"rgba(255,255,255,0.1)", padding:"5px 12px", borderRadius:20, textTransform:"capitalize" },
  nav: { background:"#fff", borderBottom:"2px solid #e2e8f0", display:"flex", overflowX:"auto", padding:"0 12px" },
  navBtn: { padding:"12px 14px", border:"none", background:"none", cursor:"pointer", fontSize:13, fontFamily:"'DM Sans',sans-serif", fontWeight:500, color:"#64748b", display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap", borderBottom:"3px solid transparent", transition:"all 0.2s", flexShrink:0, position:"relative" },
  navActive: { color:"#4f46e5", borderBottomColor:"#4f46e5", background:"#eef2ff" },
  navLbl: { fontSize:13 },
  navBadge: { position:"absolute", top:7, right:4, background:"#ef4444", color:"#fff", fontSize:10, fontWeight:800, minWidth:17, height:17, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 4px" },
  main: { maxWidth:960, margin:"0 auto", padding:"20px 14px" },
  tabContent: { display:"flex", flexDirection:"column", gap:14 },
  card: { background:"#fff", borderRadius:14, padding:18, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #e8edf2" },
  cardTitle: { fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:700, color:"#1e293b" },
  row: { display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" },
  lbl: { display:"block", fontSize:11, fontWeight:700, color:"#475569", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em" },
  sel: { width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #e2e8f0", fontSize:14, background:"#fff", color:"#1e293b", outline:"none" },
  inp: { width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #e2e8f0", fontSize:14, color:"#1e293b", outline:"none", boxSizing:"border-box" },
  sRow: { display:"flex", alignItems:"center", gap:10, padding:"9px 10px", borderRadius:8, marginBottom:2 },
  sNum: { width:24, textAlign:"center", fontSize:11, color:"#94a3b8", fontWeight:600, flexShrink:0 },
  sName: { fontSize:14, fontWeight:500, color:"#1e293b" },
  badge: { fontSize:12, fontWeight:600, padding:"3px 9px", borderRadius:12, whiteSpace:"nowrap" },
  empty: { textAlign:"center", color:"#94a3b8", padding:"28px 0", fontSize:13 },
  btnPri: { padding:"10px 18px", background:"linear-gradient(135deg,#4f46e5,#4338ca)", color:"#fff", border:"none", borderRadius:10, cursor:"pointer", fontSize:14, fontWeight:600, boxShadow:"0 4px 12px #4f46e540", whiteSpace:"nowrap" },
  btnSec: { padding:"10px 18px", background:"#f8fafc", color:"#4f46e5", border:"2px solid #c7d2fe", borderRadius:10, cursor:"pointer", fontSize:14, fontWeight:600 },
  delBtn: { background:"none", border:"none", cursor:"pointer", fontSize:17, padding:4, opacity:0.6 },
  toggleBtn: { padding:"6px 13px", border:"1.5px solid #e2e8f0", borderRadius:8, background:"#f8fafc", cursor:"pointer", fontSize:12, fontWeight:500, color:"#64748b", fontFamily:"'DM Sans',sans-serif" },
  toggleActive: { background:"#4f46e5", color:"#fff", borderColor:"#4f46e5" },
  table: { width:"100%", borderCollapse:"collapse", fontSize:13 },
  th: { padding:"9px 7px", background:"#f8fafc", fontWeight:700, color:"#475569", textAlign:"center", fontSize:11, textTransform:"uppercase", letterSpacing:"0.04em", borderBottom:"2px solid #e2e8f0" },
  td: { padding:"9px 7px", textAlign:"center", borderBottom:"1px solid #f1f5f9", color:"#334155" },
  toast: { position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"#1e1b4b", color:"#fff", padding:"12px 22px", borderRadius:24, fontSize:14, fontWeight:500, zIndex:999, boxShadow:"0 8px 24px rgba(0,0,0,0.3)", whiteSpace:"nowrap" },
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20, backdropFilter:"blur(4px)" },
  modal: { background:"#fff", borderRadius:20, padding:24, maxWidth:380, width:"100%", boxShadow:"0 24px 60px rgba(0,0,0,0.3)" },
  modalIcon: { fontSize:44, textAlign:"center", marginBottom:8 },
  modalTitle: { fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:800, color:"#1e1b4b", textAlign:"center", marginBottom:4 },
};

import { useState } from "react";
import { Plus, Pencil, Trash2, Play } from "lucide-react";
import type { AppData, PlannedBlock, PlannedSession } from "./model";
import { emptyData, localDate, uid } from "./model";
import { eightWeekPlan } from "./planning";
import { RunStructureEditor, runSummaryLabel } from "./RunStructureEditor";
import { SafeNumberInput } from "./SafeNumberInput";
import { Modal, SectionTitle } from "./ui";

export function Planner({ data, change, start }: {
  data: AppData;
  change: (fn: (d: AppData) => AppData) => void;
  start: (plan: PlannedSession) => void;
}) {
  const [editing,setEditing] = useState<PlannedSession | null>(null);
  const [filter,setFilter] = useState("upcoming");
  const plans = [...(data.plans ?? [])].filter(p => filter === "all" || p.date >= localDate()).sort((a,b)=>a.date.localeCompare(b.date));
  function save(plan: PlannedSession) {
    if (!plan.name.trim() || !plan.blocks.length) return;
    change(d => ({...d,plans: d.plans?.some(p=>p.id===plan.id)
      ? d.plans.map(p=>p.id===plan.id?plan:p)
      : [...(d.plans??[]),plan]}));
    setEditing(null);
  }
  return <>
    <SectionTitle eyebrow="ПОДГОТОВКА К ПОЛУМАРАФОНУ" title="План тренировок">
      <button className="primary" onClick={()=>setEditing({id:uid(),date:localDate(),name:"Новая тренировка",blocks:[],note:""})}>
        <Plus size={17}/> Добавить
      </button>
    </SectionTitle>
    <p className="muted">План можно изменять в любой момент. Завершённые занятия останутся в журнале без изменений.</p>
    <div className="planner-toolbar">
      <select aria-label="Показать тренировки" value={filter} onChange={e=>setFilter(e.target.value)}>
        <option value="upcoming">Предстоящие</option><option value="all">Все</option>
      </select>
      <button className="secondary" onClick={()=>{
        if ((data.plans??[]).length && !window.confirm("Добавить 24 занятия? Существующий план останется без изменений.")) return;
        change(d=>{
          const missing = emptyData().exercises.filter(e=>!d.exercises.some(x=>x.id===e.id));
          const withExercises = {...d,exercises:[...d.exercises,...missing]};
          return {...withExercises,plans:[...(d.plans??[]),...eightWeekPlan(withExercises)]};
        });
      }}>Добавить план на 8 недель</button>
    </div>
    <div className="session-list">
      {plans.map(p=>{
        const w = data.workouts.find(w=>w.planId===p.id);
        return <section className="planner-session" key={p.id}>
          <div><strong>{p.name}</strong><small>{p.date} · {p.blocks.length} блоков {w ? " · Начата" : ""}</small></div>
          <div className="planner-blocks">{p.blocks.map(b=><span key={b.id}>{b.type==="run" ? runSummaryLabel(b) : `${b.exercise.name} · ${b.sets}×${b.reps}`}</span>)}</div>
          <div className="inline-actions">
            <button className="text-button" onClick={()=>setEditing(structuredClone(p))}><Pencil size={15}/> Изменить</button>
            <button className="text-button" disabled={Boolean(w)} onClick={()=>start(p)}><Play size={15}/> {w?"Уже начата":"Начать"}</button>
            <button className="icon-button danger" aria-label={"Удалить "+p.name} onClick={()=>{
              if(window.confirm("Удалить занятие из плана? История выполненных тренировок сохранится."))
                change(d=>({...d,plans:(d.plans??[]).filter(x=>x.id!==p.id)}));
            }}><Trash2 size={16}/></button>
          </div>
        </section>;
      })}
    </div>
    {!plans.length && <p className="muted">План пока пуст. Добавь отдельную тренировку или готовый 8-недельный план.</p>}
    {editing && <PlanEditor key={editing.id} value={editing} data={data} save={save} close={()=>setEditing(null)}/>}
  </>;
}
function PlanEditor({value,data,save,close}:{
  value:PlannedSession;data:AppData;save:(p:PlannedSession)=>void;close:()=>void
}) {
  const [p,setP]=useState(value);
  const [exerciseId,setExerciseId]=useState(data.exercises[0]?.id??"");
  const updateBlock=(id:string, patch:Partial<PlannedBlock>)=>setP(p=>({...p,blocks:p.blocks.map(b=>b.id===id?{...b,...patch} as PlannedBlock:b)}));
  return <Modal title="Запланировать тренировку" close={close}>
    <form onSubmit={e=>{e.preventDefault();save(p)}}>
      <label>Название<input required maxLength={100} value={p.name} onChange={e=>setP({...p,name:e.target.value})}/></label>
      <label>Дата<input required type="date" value={p.date} onChange={e=>setP({...p,date:e.target.value})}/></label>
      <label>Заметка<textarea maxLength={1000} value={p.note} onChange={e=>setP({...p,note:e.target.value})}/></label>
      <div className="planner-blocks">{p.blocks.map(b=><div className="planner-edit-block" key={b.id}>
        <div className="planner-edit-head"><strong>{b.type==="run"?"Бег":b.exercise.name}</strong>
          <button type="button" className="icon-button danger" aria-label="Удалить блок" onClick={()=>setP({...p,blocks:p.blocks.filter(x=>x.id!==b.id)})}><Trash2 size={15}/></button>
        </div>
        {b.type==="run" ? <div>
          <RunStructureEditor mode={b.mode} segments={b.segments} cycles={b.cycles} speedKmh={b.speedKmh} onChange={patch=>updateBlock(b.id,patch)}/>
          <label>Плановое время всего занятия, мин<SafeNumberInput min={1} max={600} integer value={b.minutes} onValueChange={n=>updateBlock(b.id,{minutes:n})}/></label>
        </div> : <div className="form-columns">
          <label>Подходов<input type="number" min={1} max={20} required value={b.sets} onChange={e=>updateBlock(b.id,{sets:Number(e.target.value)})}/></label>
          <label>Повторов<input type="number" min={1} max={999} required value={b.reps} onChange={e=>updateBlock(b.id,{reps:Number(e.target.value)})}/></label>
          <label>Вес / помощь, кг<input type="number" min={0} max={9999} step={0.5} required value={b.weight} onChange={e=>updateBlock(b.id,{weight:Number(e.target.value)})}/></label>
          <label>Отдых, сек<input type="number" min={0} max={1800} required value={b.restSeconds} onChange={e=>updateBlock(b.id,{restSeconds:Number(e.target.value)})}/></label>
        </div>}
        <label>Комментарий<input maxLength={500} value={b.note} onChange={e=>updateBlock(b.id,{note:e.target.value})}/></label>
      </div>)}</div>
      <div className="form-columns"><label>Упражнение из библиотеки<select value={exerciseId} onChange={e=>setExerciseId(e.target.value)}>
        {data.exercises.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
      </select></label>
      <button type="button" className="secondary" onClick={()=>{
        const exercise=data.exercises.find(e=>e.id===exerciseId);
        if(exercise) setP({...p,blocks:[...p.blocks,{id:uid(),type:"strength",exercise:structuredClone(exercise),sets:3,reps:10,weight:0,restSeconds:120,note:""}]});
      }}>Добавить упражнение</button></div>
      <button type="button" className="secondary full" onClick={()=>setP({...p,blocks:[...p.blocks,{id:uid(),type:"run",mode:"free",minutes:25,speedKmh:0,note:"Лёгкий бег"}]})}>+ Добавить бег</button>
      <button className="primary full" disabled={!p.blocks.length}>Сохранить план</button>
    </form>
  </Modal>;
}

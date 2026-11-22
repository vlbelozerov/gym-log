import type { RunMode, RunSegment } from "./model";
import { uid } from "./model";
import { SafeNumberInput } from "./SafeNumberInput";

export const runModeLabels: Record<RunMode,string> = {
  free:"Свободный темп",
  steady:"Постоянная скорость",
  run_walk:"Бег / ходьба",
  intervals:"Интервалы",
};
export function defaultSegments(mode: RunMode): RunSegment[] {
  if(mode==="run_walk") return [
    {id:uid(),kind:"run",basis:"time",amount:3,speedKmh:6,repeats:1},
    {id:uid(),kind:"walk",basis:"time",amount:2,speedKmh:5,repeats:1},
  ];
  if(mode==="intervals") return [
    {id:uid(),kind:"run",basis:"time",amount:1,speedKmh:7,repeats:1},
    {id:uid(),kind:"recovery",basis:"time",amount:2,speedKmh:5,repeats:1},
  ];
  return [];
}
export function runSummaryLabel(value: {mode?:RunMode;segments?:RunSegment[];cycles?:number; speedKmh:number;minutes:number}) {
  const mode=value.mode ?? "steady";
  if(mode==="free") return `Свободный темп · ориентир ${value.minutes} мин`;
  if(mode==="steady") return `Ровный бег · ${value.minutes} мин · ${value.speedKmh} км/ч`;
  return `${runModeLabels[mode]} · ${value.cycles ?? 1} циклов · ${(value.segments??[]).map(s=>`${s.amount} ${s.basis==="time"?"мин":"км"} ${s.kind==="walk"?"ходьба":s.kind==="recovery"?"восстановление":"бег"} ${s.speedKmh?s.speedKmh+" км/ч":"свободно"}`).join(" / ")}`;
}
export function RunStructureEditor({mode,segments,cycles,speedKmh,onChange}:{
  mode?: RunMode; segments?: RunSegment[]; cycles?:number; speedKmh:number;
  onChange:(patch:{mode?:RunMode;segments?:RunSegment[];cycles?:number;speedKmh?:number})=>void;
}) {
  const current=mode ?? "steady";
  const structured=current==="run_walk"||current==="intervals";
  return <div className="run-structure">
    <label>Тип беговой тренировки
      <select value={current} onChange={e=>{
        const next=e.target.value as RunMode;
        onChange({mode:next,segments:defaultSegments(next),cycles:next==="intervals"?4:next==="run_walk"?6:1,
          speedKmh:next==="free"?0:speedKmh||6});
      }}>
        {Object.entries(runModeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    {current==="steady" && <label>Целевая скорость, км/ч
      <SafeNumberInput min={0.1} max={30} step={0.1} value={speedKmh} onValueChange={n=>onChange({speedKmh:n})}/>
    </label>}
    {structured && <>
      <label>Повторить весь цикл, раз
        <SafeNumberInput min={1} max={100} integer value={cycles??1} onValueChange={n=>onChange({cycles:n})}/>
      </label>
      {(segments??[]).map((s,i)=><div className="run-segment" key={s.id}>
        <div className="run-segment-head"><strong>Отрезок {i+1}</strong>
          <button type="button" disabled={(segments??[]).length<=1} className="text-button danger" onClick={()=>onChange({segments:(segments??[]).filter(x=>x.id!==s.id)})}>Удалить</button>
        </div>
        <div className="form-columns">
          <label>Тип
            <select value={s.kind} onChange={e=>onChange({segments:(segments??[]).map(x=>x.id===s.id?{...x,kind:e.target.value as RunSegment["kind"]}:x)})}>
              <option value="run">Бег</option><option value="walk">Ходьба</option><option value="recovery">Восстановление</option>
            </select>
          </label>
          <label>Задать по
            <select value={s.basis} onChange={e=>onChange({segments:(segments??[]).map(x=>x.id===s.id?{...x,basis:e.target.value as RunSegment["basis"],amount:1}:x)})}>
              <option value="time">Времени</option><option value="distance">Дистанции</option>
            </select>
          </label>
          <label>{s.basis==="time"?"Минуты":"Километры"}
            <SafeNumberInput min={0.01} max={s.basis==="time"?600:100} step={0.1} value={s.amount} onValueChange={n=>onChange({segments:(segments??[]).map(x=>x.id===s.id?{...x,amount:n}:x)})}/>
          </label>
          <label>Скорость, км/ч (0 = свободно)
            <SafeNumberInput min={0} max={30} step={0.1} value={s.speedKmh} onValueChange={n=>onChange({segments:(segments??[]).map(x=>x.id===s.id?{...x,speedKmh:n}:x)})}/>
          </label>
        </div>
      </div>)}
      <button type="button" className="secondary full" disabled={(segments??[]).length>=60} onClick={()=>onChange({segments:[...(segments??[]),{id:uid(),kind:"run",basis:"time",amount:1,speedKmh:0,repeats:1}]})}>+ Добавить отрезок</button>
      <p className="small muted">Отрезки выполняются по порядку; весь цикл повторяется указанное число раз. Для свободного темпа отрезка укажи скорость 0.</p>
    </>}
  </div>;
}

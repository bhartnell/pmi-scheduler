'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, ChevronUp, Save, Plus, Trash2 } from 'lucide-react';

const CATEGORIES = ['Medical', 'Trauma', 'Cardiac', 'Respiratory', 'Pediatric', 'OB/GYN', 'Behavioral', 'Neurological', 'Environmental', 'Toxicology'];
const PROGRAMS = ['EMT', 'AEMT', 'Paramedic'];

function FormSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg bg-white">
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full px-4 py-3 flex items-center justify-between bg-gray-50">
        <span className="font-medium text-gray-900">{title}</span>
        {isOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
      </button>
      {isOpen && <div className="p-4 border-t space-y-4">{children}</div>}
    </div>
  );
}

function ArrayInput({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <button type="button" onClick={() => onChange([...values, ''])} className="text-sm text-blue-600 flex items-center gap-1"><Plus className="w-4 h-4" />Add</button>
      </div>
      {values.length === 0 ? <p className="text-sm text-gray-500 italic">No items</p> : values.map((v, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <input type="text" value={v} onChange={(e) => { const n = [...values]; n[i] = e.target.value; onChange(n); }} placeholder={placeholder} className="flex-1 px-3 py-2 border rounded-lg text-gray-900 bg-white text-sm" />
          <button type="button" onClick={() => onChange(values.filter((_, idx) => idx !== i))} className="p-2 text-red-600"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
    </div>
  );
}

export default function NewScenarioPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Basic info
  const [title, setTitle] = useState('');
  const [programs, setPrograms] = useState<string[]>(['EMT', 'AEMT', 'Paramedic']);
  const [category, setCategory] = useState('Medical');
  const [subcategory, setSubcategory] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [documentationRequired, setDocumentationRequired] = useState(false);
  const [platinumRequired, setPlatinumRequired] = useState(false);

  // Dispatch
  const [dispatchTime, setDispatchTime] = useState('');
  const [dispatchLocation, setDispatchLocation] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');

  // Patient
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientSex, setPatientSex] = useState('');
  const [medicalHistory, setMedicalHistory] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [allergies, setAllergies] = useState('');

  // Assessment
  const [generalImpression, setGeneralImpression] = useState('');
  const [assessmentA, setAssessmentA] = useState('');
  const [assessmentB, setAssessmentB] = useState('');
  const [assessmentC, setAssessmentC] = useState('');
  const [assessmentD, setAssessmentD] = useState('');

  // Vitals
  const [vitalsBP, setVitalsBP] = useState('');
  const [vitalsPulse, setVitalsPulse] = useState('');
  const [vitalsResp, setVitalsResp] = useState('');
  const [vitalsSpO2, setVitalsSpO2] = useState('');

  // Educational
  const [learningObjectives, setLearningObjectives] = useState<string[]>([]);
  const [criticalActions, setCriticalActions] = useState<string[]>([]);
  const [instructorNotes, setInstructorNotes] = useState('');
  const [equipmentNeeded, setEquipmentNeeded] = useState<string[]>([]);

  useEffect(() => { if (status === 'unauthenticated') router.push('/auth/signin'); }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !category) { alert('Title and category required'); return; }
    setSaving(true);

    const vitals = { bp: vitalsBP || undefined, pulse: vitalsPulse ? parseInt(vitalsPulse) : undefined, resp: vitalsResp ? parseInt(vitalsResp) : undefined, spo2: vitalsSpO2 ? parseInt(vitalsSpO2) : undefined };
    Object.keys(vitals).forEach(k => { if (vitals[k as keyof typeof vitals] === undefined) delete vitals[k as keyof typeof vitals]; });

    try {
      const res = await fetch('/api/lab-management/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, applicable_programs: programs, category, subcategory: subcategory || null, difficulty,
          chief_complaint: chiefComplaint || null, estimated_duration: estimatedDuration ? parseInt(estimatedDuration) : null,
          documentation_required: documentationRequired, platinum_required: platinumRequired,
          dispatch_time: dispatchTime || null, dispatch_location: dispatchLocation || null, dispatch_notes: dispatchNotes || null,
          patient_name: patientName || null, patient_age: patientAge ? parseInt(patientAge) : null, patient_sex: patientSex || null,
          medical_history: medicalHistory.filter(Boolean), medications: medications.filter(Boolean), allergies: allergies || null,
          general_impression: generalImpression || null,
          assessment_a: assessmentA || null, assessment_b: assessmentB || null, assessment_c: assessmentC || null, assessment_d: assessmentD || null,
          initial_vitals: Object.keys(vitals).length > 0 ? vitals : null,
          learning_objectives: learningObjectives.filter(Boolean), critical_actions: criticalActions.filter(Boolean),
          instructor_notes: instructorNotes || null, equipment_needed: equipmentNeeded.filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.success) router.push(`/lab-management/scenarios/${data.scenario.id}`);
      else alert('Error: ' + data.error);
    } catch (err) { alert('Failed to create'); }
    setSaving(false);
  };

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/scenarios" className="hover:text-blue-600">Scenarios</Link>
            <ChevronRight className="w-4 h-4" /><span>New</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create Scenario</h1>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white" placeholder="e.g., COPD Exacerbation" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white">
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaint</label>
                <input type="text" value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white" placeholder="Difficulty breathing" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Programs</label>
                <div className="flex gap-2">{PROGRAMS.map(p => (
                  <button key={p} type="button" onClick={() => setPrograms(programs.includes(p) ? programs.filter(x => x !== p) : [...programs, p])}
                    className={`px-3 py-1 rounded-full text-sm ${programs.includes(p) ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>{p}</button>
                ))}</div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={documentationRequired} onChange={e => setDocumentationRequired(e.target.checked)} className="rounded" /><span className="text-sm text-gray-700">Documentation Required</span></label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={platinumRequired} onChange={e => setPlatinumRequired(e.target.checked)} className="rounded" /><span className="text-sm text-gray-700">Platinum Required</span></label>
              </div>
            </div>
          </div>

          <FormSection title="Dispatch Information">
            <div className="grid grid-cols-2 gap-4">
              <input type="text" value={dispatchTime} onChange={e => setDispatchTime(e.target.value)} placeholder="Time (e.g., 1430)" className="px-3 py-2 border rounded-lg text-gray-900 bg-white" />
              <input type="text" value={dispatchLocation} onChange={e => setDispatchLocation(e.target.value)} placeholder="Location" className="px-3 py-2 border rounded-lg text-gray-900 bg-white" />
            </div>
            <textarea value={dispatchNotes} onChange={e => setDispatchNotes(e.target.value)} placeholder="Dispatch notes..." rows={2} className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white" />
          </FormSection>

          <FormSection title="Patient Information">
            <div className="grid grid-cols-3 gap-4">
              <input type="text" value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Name" className="px-3 py-2 border rounded-lg text-gray-900 bg-white" />
              <input type="text" value={patientAge} onChange={e => setPatientAge(e.target.value)} placeholder="Age" className="px-3 py-2 border rounded-lg text-gray-900 bg-white" />
              <select value={patientSex} onChange={e => setPatientSex(e.target.value)} className="px-3 py-2 border rounded-lg text-gray-900 bg-white"><option value="">Sex</option><option value="Male">Male</option><option value="Female">Female</option></select>
            </div>
            <ArrayInput label="Medical History" values={medicalHistory} onChange={setMedicalHistory} placeholder="e.g., COPD, HTN" />
            <ArrayInput label="Medications" values={medications} onChange={setMedications} placeholder="e.g., Metformin" />
            <input type="text" value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="Allergies" className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white" />
          </FormSection>

          <FormSection title="Assessment">
            <textarea value={generalImpression} onChange={e => setGeneralImpression(e.target.value)} placeholder="General impression on arrival..." rows={2} className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white" />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={assessmentA} onChange={e => setAssessmentA(e.target.value)} placeholder="A - Airway" className="px-3 py-2 border rounded-lg text-gray-900 bg-white" />
              <input type="text" value={assessmentB} onChange={e => setAssessmentB(e.target.value)} placeholder="B - Breathing" className="px-3 py-2 border rounded-lg text-gray-900 bg-white" />
              <input type="text" value={assessmentC} onChange={e => setAssessmentC(e.target.value)} placeholder="C - Circulation" className="px-3 py-2 border rounded-lg text-gray-900 bg-white" />
              <input type="text" value={assessmentD} onChange={e => setAssessmentD(e.target.value)} placeholder="D - Disability" className="px-3 py-2 border rounded-lg text-gray-900 bg-white" />
            </div>
          </FormSection>

          <FormSection title="Initial Vitals">
            <div className="grid grid-cols-4 gap-3">
              <input type="text" value={vitalsBP} onChange={e => setVitalsBP(e.target.value)} placeholder="BP" className="px-3 py-2 border rounded-lg text-gray-900 bg-white text-sm" />
              <input type="text" value={vitalsPulse} onChange={e => setVitalsPulse(e.target.value)} placeholder="Pulse" className="px-3 py-2 border rounded-lg text-gray-900 bg-white text-sm" />
              <input type="text" value={vitalsResp} onChange={e => setVitalsResp(e.target.value)} placeholder="RR" className="px-3 py-2 border rounded-lg text-gray-900 bg-white text-sm" />
              <input type="text" value={vitalsSpO2} onChange={e => setVitalsSpO2(e.target.value)} placeholder="SpO2" className="px-3 py-2 border rounded-lg text-gray-900 bg-white text-sm" />
            </div>
          </FormSection>

          <FormSection title="Educational Content" defaultOpen>
            <ArrayInput label="Learning Objectives" values={learningObjectives} onChange={setLearningObjectives} placeholder="Objective..." />
            <ArrayInput label="Critical Actions" values={criticalActions} onChange={setCriticalActions} placeholder="Critical action..." />
            <ArrayInput label="Equipment Needed" values={equipmentNeeded} onChange={setEquipmentNeeded} placeholder="Equipment..." />
            <textarea value={instructorNotes} onChange={e => setInstructorNotes(e.target.value)} placeholder="Instructor notes..." rows={3} className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white" />
          </FormSection>

          <div className="flex gap-3 pt-4">
            <Link href="/lab-management/scenarios" className="px-6 py-3 border text-gray-700 rounded-lg hover:bg-gray-50">Cancel</Link>
            <button type="submit" disabled={saving || !title} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
              {saving ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>Saving...</> : <><Save className="w-5 h-5" />Create Scenario</>}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Edit2,
  Clock,
  AlertCircle,
  Activity,
  FileText,
  Stethoscope,
  Pill,
  ClipboardList,
  MessageSquare,
  Package,
  Target,
  Users
} from 'lucide-react';

interface Scenario {
  id: string;
  title: string;
  applicable_programs: string[];
  category: string;
  subcategory: string | null;
  difficulty: string;
  dispatch_time: string | null;
  dispatch_location: string | null;
  chief_complaint: string | null;
  dispatch_notes: string | null;
  patient_name: string | null;
  patient_age: number | null;
  patient_sex: string | null;
  patient_weight: string | null;
  medical_history: string[];
  medications: string[];
  allergies: string | null;
  general_impression: string | null;
  environment_notes: string | null;
  assessment_x: string | null;
  assessment_a: string | null;
  assessment_b: string | null;
  assessment_c: string | null;
  assessment_d: string | null;
  assessment_e: string | null;
  avpu: string | null;
  initial_vitals: any;
  sample_history: any;
  opqrst: any;
  phases: any[];
  learning_objectives: string[];
  critical_actions: string[];
  debrief_points: string[];
  instructor_notes: string | null;
  equipment_needed: string[];
  medications_to_administer: string[];
  estimated_duration: number | null;
  documentation_required: boolean;
  platinum_required: boolean;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-yellow-100 text-yellow-800',
  advanced: 'bg-red-100 text-red-800',
};

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
      >
        <div className="flex items-center gap-2 font-medium text-gray-900">
          {icon}
          {title}
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 border-t">
          {children}
        </div>
      )}
    </div>
  );
}

export default function ScenarioDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const scenarioId = params.id as string;

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && scenarioId) {
      fetchScenario();
    }
  }, [session, scenarioId]);

  const fetchScenario = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lab-management/scenarios/${scenarioId}`);
      const data = await res.json();
      
      if (data.success) {
        setScenario(data.scenario);
      }
    } catch (error) {
      console.error('Error fetching scenario:', error);
    }
    setLoading(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading scenario...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  if (!scenario) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Scenario Not Found</h2>
          <Link
            href="/lab-management/scenarios"
            className="text-blue-600 hover:underline"
          >
            Back to Scenarios
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
                <ChevronRight className="w-4 h-4" />
                <Link href="/lab-management/scenarios" className="hover:text-blue-600">Scenarios</Link>
                <ChevronRight className="w-4 h-4" />
                <span className="truncate max-w-[150px]">{scenario.title}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{scenario.title}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="px-2 py-1 bg-gray-100 text-gray-800 text-sm rounded">
                  {scenario.category}
                </span>
                <span className={`px-2 py-1 text-sm rounded ${DIFFICULTY_COLORS[scenario.difficulty]}`}>
                  {scenario.difficulty}
                </span>
                {scenario.platinum_required && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-sm rounded">
                    Platinum
                  </span>
                )}
                {scenario.documentation_required && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                    Documentation
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {scenario.applicable_programs.map(prog => (
                  <span key={prog} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                    {prog}
                  </span>
                ))}
              </div>
            </div>
            <Link
              href={`/lab-management/scenarios/${scenarioId}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shrink-0"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* Quick Info */}
        {(scenario.estimated_duration || scenario.chief_complaint) && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {scenario.chief_complaint && (
                <div>
                  <div className="text-sm font-medium text-gray-500">Chief Complaint</div>
                  <div className="text-gray-900">{scenario.chief_complaint}</div>
                </div>
              )}
              {scenario.estimated_duration && (
                <div>
                  <div className="text-sm font-medium text-gray-500">Duration</div>
                  <div className="text-gray-900 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    ~{scenario.estimated_duration} minutes
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dispatch Information */}
        {(scenario.dispatch_time || scenario.dispatch_location || scenario.dispatch_notes) && (
          <CollapsibleSection 
            title="Dispatch Information" 
            icon={<MessageSquare className="w-5 h-5 text-blue-600" />}
            defaultOpen={true}
          >
            <div className="space-y-3 text-sm">
              {scenario.dispatch_time && (
                <div><span className="font-medium">Time:</span> {scenario.dispatch_time}</div>
              )}
              {scenario.dispatch_location && (
                <div><span className="font-medium">Location:</span> {scenario.dispatch_location}</div>
              )}
              {scenario.dispatch_notes && (
                <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                  <span className="font-medium">Dispatch Notes:</span> {scenario.dispatch_notes}
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Patient Information */}
        {(scenario.patient_name || scenario.patient_age || scenario.medical_history?.length > 0) && (
          <CollapsibleSection 
            title="Patient Information" 
            icon={<Users className="w-5 h-5 text-green-600" />}
            defaultOpen={true}
          >
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {scenario.patient_name && <div><span className="font-medium">Name:</span> {scenario.patient_name}</div>}
                {scenario.patient_age && <div><span className="font-medium">Age:</span> {scenario.patient_age}</div>}
                {scenario.patient_sex && <div><span className="font-medium">Sex:</span> {scenario.patient_sex}</div>}
                {scenario.patient_weight && <div><span className="font-medium">Weight:</span> {scenario.patient_weight}</div>}
              </div>
              {scenario.medical_history?.length > 0 && (
                <div>
                  <span className="font-medium">Medical History:</span>
                  <ul className="list-disc list-inside ml-2 mt-1">
                    {scenario.medical_history.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
              )}
              {scenario.medications?.length > 0 && (
                <div>
                  <span className="font-medium">Medications:</span>
                  <ul className="list-disc list-inside ml-2 mt-1">
                    {scenario.medications.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
              )}
              {scenario.allergies && (
                <div className="bg-red-50 p-2 rounded border border-red-200">
                  <span className="font-medium text-red-800">Allergies:</span> {scenario.allergies}
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Upon Arrival / General Impression */}
        {(scenario.general_impression || scenario.environment_notes) && (
          <CollapsibleSection 
            title="Upon Arrival" 
            icon={<Activity className="w-5 h-5 text-orange-600" />}
          >
            <div className="space-y-3 text-sm">
              {scenario.general_impression && (
                <div className="bg-blue-50 p-3 rounded">
                  <span className="font-medium">General Impression:</span> {scenario.general_impression}
                </div>
              )}
              {scenario.environment_notes && (
                <div><span className="font-medium">Environment:</span> {scenario.environment_notes}</div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Assessment (XABCDE) */}
        {(scenario.assessment_x || scenario.assessment_a || scenario.assessment_b || scenario.assessment_c || scenario.assessment_d || scenario.assessment_e) && (
          <CollapsibleSection 
            title="Initial Assessment (XABCDE)" 
            icon={<Stethoscope className="w-5 h-5 text-red-600" />}
          >
            <div className="space-y-2 text-sm">
              {scenario.assessment_x && <div><span className="font-medium text-red-600">X - Exsanguination:</span> {scenario.assessment_x}</div>}
              {scenario.assessment_a && <div><span className="font-medium text-orange-600">A - Airway:</span> {scenario.assessment_a}</div>}
              {scenario.assessment_b && <div><span className="font-medium text-yellow-600">B - Breathing:</span> {scenario.assessment_b}</div>}
              {scenario.assessment_c && <div><span className="font-medium text-green-600">C - Circulation:</span> {scenario.assessment_c}</div>}
              {scenario.assessment_d && <div><span className="font-medium text-blue-600">D - Disability:</span> {scenario.assessment_d}</div>}
              {scenario.assessment_e && <div><span className="font-medium text-purple-600">E - Exposure:</span> {scenario.assessment_e}</div>}
              {scenario.avpu && <div><span className="font-medium">AVPU:</span> {scenario.avpu}</div>}
            </div>
          </CollapsibleSection>
        )}

        {/* Initial Vitals */}
        {scenario.initial_vitals && Object.keys(scenario.initial_vitals).length > 0 && (
          <CollapsibleSection 
            title="Initial Vitals" 
            icon={<Activity className="w-5 h-5 text-pink-600" />}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {scenario.initial_vitals.bp && <div><span className="font-medium">BP:</span> {scenario.initial_vitals.bp}</div>}
              {scenario.initial_vitals.pulse && <div><span className="font-medium">Pulse:</span> {scenario.initial_vitals.pulse}</div>}
              {scenario.initial_vitals.resp && <div><span className="font-medium">RR:</span> {scenario.initial_vitals.resp}</div>}
              {scenario.initial_vitals.spo2 && <div><span className="font-medium">SpO2:</span> {scenario.initial_vitals.spo2}%</div>}
              {scenario.initial_vitals.etco2 && <div><span className="font-medium">EtCO2:</span> {scenario.initial_vitals.etco2}</div>}
              {scenario.initial_vitals.temp && <div><span className="font-medium">Temp:</span> {scenario.initial_vitals.temp}</div>}
              {scenario.initial_vitals.glucose && <div><span className="font-medium">Glucose:</span> {scenario.initial_vitals.glucose}</div>}
              {scenario.initial_vitals.gcs && <div><span className="font-medium">GCS:</span> {scenario.initial_vitals.gcs}</div>}
            </div>
          </CollapsibleSection>
        )}

        {/* Scenario Phases/Progression */}
        {scenario.phases && scenario.phases.length > 0 && (
          <CollapsibleSection 
            title="Scenario Progression" 
            icon={<Target className="w-5 h-5 text-indigo-600" />}
          >
            <div className="space-y-4">
              {scenario.phases.map((phase: any, index: number) => (
                <div key={index} className="border-l-4 border-indigo-400 pl-4">
                  <h4 className="font-medium text-gray-900">
                    Phase {phase.phase_number || index + 1}: {phase.title}
                  </h4>
                  {phase.trigger && (
                    <p className="text-sm text-indigo-600 mt-1">Trigger: {phase.trigger}</p>
                  )}
                  {phase.description && (
                    <p className="text-sm text-gray-600 mt-1">{phase.description}</p>
                  )}
                  {phase.expected_actions && phase.expected_actions.length > 0 && (
                    <div className="mt-2">
                      <span className="text-sm font-medium">Expected Actions:</span>
                      <ul className="list-disc list-inside text-sm text-gray-600 ml-2">
                        {phase.expected_actions.map((action: string, i: number) => (
                          <li key={i}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Learning Objectives */}
        {scenario.learning_objectives?.length > 0 && (
          <CollapsibleSection 
            title="Learning Objectives" 
            icon={<Target className="w-5 h-5 text-green-600" />}
          >
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
              {scenario.learning_objectives.map((obj, i) => <li key={i}>{obj}</li>)}
            </ul>
          </CollapsibleSection>
        )}

        {/* Critical Actions */}
        {scenario.critical_actions?.length > 0 && (
          <CollapsibleSection 
            title="Critical Actions" 
            icon={<AlertCircle className="w-5 h-5 text-red-600" />}
          >
            <ul className="space-y-2 text-sm">
              {scenario.critical_actions.map((action, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-6 h-6 bg-red-100 text-red-800 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-gray-700">{action}</span>
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}

        {/* Equipment & Medications */}
        {(scenario.equipment_needed?.length > 0 || scenario.medications_to_administer?.length > 0) && (
          <CollapsibleSection 
            title="Equipment & Medications" 
            icon={<Package className="w-5 h-5 text-gray-600" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {scenario.equipment_needed?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Equipment Needed:</h4>
                  <ul className="list-disc list-inside text-gray-600">
                    {scenario.equipment_needed.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
              )}
              {scenario.medications_to_administer?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Medications:</h4>
                  <ul className="list-disc list-inside text-gray-600">
                    {scenario.medications_to_administer.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Instructor Notes */}
        {scenario.instructor_notes && (
          <CollapsibleSection 
            title="Instructor Notes" 
            icon={<FileText className="w-5 h-5 text-yellow-600" />}
          >
            <div className="bg-yellow-50 p-3 rounded text-sm text-gray-700 whitespace-pre-wrap">
              {scenario.instructor_notes}
            </div>
          </CollapsibleSection>
        )}

        {/* Debrief Points */}
        {scenario.debrief_points?.length > 0 && (
          <CollapsibleSection 
            title="Debrief Points" 
            icon={<ClipboardList className="w-5 h-5 text-purple-600" />}
          >
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
              {scenario.debrief_points.map((point, i) => <li key={i}>{point}</li>)}
            </ul>
          </CollapsibleSection>
        )}
      </main>
    </div>
  );
}

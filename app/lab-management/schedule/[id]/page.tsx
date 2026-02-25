'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Calendar,
  Plus,
  Edit2,
  ClipboardCheck,
  FileText,
  Users,
  MapPin,
  Clock,
  Check,
  AlertCircle,
  Printer,
  Download,
  X,
  Save,
  Trash2,
  Timer,
  Repeat,
  Upload,
  ExternalLink,
  Copy,
  ListChecks,
  RefreshCw,
  Square,
  CheckSquare,
  Package,
  RotateCcw,
  AlertTriangle,
  HelpCircle,
  Link2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  UserCheck
} from 'lucide-react';
import LabTimer from '@/components/LabTimer';
import InlineTimerWidget from '@/components/InlineTimerWidget';
import BLSPlatinumChecklist from '@/components/BLSPlatinumChecklist';
import AttendanceSection from '@/components/AttendanceSection';

interface LabDay {
  id: string;
  date: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  week_number: number | null;
  day_number: number | null;
  num_rotations: number;
  rotation_duration: number;
  notes: string | null;
  checkin_token: string | null;
  checkin_enabled: boolean;
  cohort: {
    id: string;
    cohort_number: number;
    program: {
      name: string;
      abbreviation: string;
    };
  };
  stations: Station[];
}

interface Station {
  id: string;
  station_number: number;
  station_type: string;
  scenario?: {
    id: string;
    title: string;
    category: string;
    difficulty: string;
  };
  skill_name: string | null;
  custom_title: string | null;
  skill_sheet_url: string | null;
  instructions_url: string | null;
  station_notes: string | null;
  instructor_name: string | null;
  instructor_email: string | null;
  room: string | null;
  notes: string | null;
  rotation_minutes: number;
  num_rotations: number;
  // Legacy fields for backwards compatibility
  instructor?: {
    id: string;
    name: string;
  };
  location: string | null;
  documentation_required: boolean;
  platinum_required: boolean;
}

interface Scenario {
  id: string;
  title: string;
  category: string;
  difficulty: string;
}

interface SkillDocument {
  id: string;
  document_name: string;
  document_url: string;
  document_type: string;
  file_type: string;
  display_order: number;
}

interface Skill {
  id: string;
  name: string;
  category: string;
  certification_levels?: string[];
  documents?: SkillDocument[];
}

interface Instructor {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface LabDayRole {
  id: string;
  lab_day_id: string;
  instructor_id: string;
  role: 'lab_lead' | 'roamer' | 'observer';
  notes: string | null;
  instructor?: {
    id: string;
    name: string;
    email: string;
  };
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  cohort_id: string;
}

interface ScenarioParticipation {
  id: string;
  student_id: string;
  scenario_id: string | null;
  scenario_name: string | null;
  role: 'team_lead' | 'med_tech' | 'monitor_tech' | 'airway_tech' | 'observer';
  lab_day_id: string | null;
  date: string;
  student?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

interface ChecklistItem {
  id: string;
  lab_day_id: string;
  title: string;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  is_auto_generated: boolean;
  sort_order: number;
  created_at: string;
}

interface EquipmentItem {
  id: string;
  lab_day_id: string;
  name: string;
  quantity: number;
  status: 'checked_out' | 'returned' | 'damaged' | 'missing';
  station_id: string | null;
  notes: string | null;
  checked_out_by: string | null;
  returned_by: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
  station?: {
    id: string;
    station_number: number;
    custom_title: string | null;
    skill_name: string | null;
    station_type: string;
  } | null;
}

const STATION_TYPES = [
  { value: 'scenario', label: 'Scenario', description: 'Full scenario with grading' },
  { value: 'skills', label: 'Skills', description: 'Skills practice station' },
  { value: 'skill_drill', label: 'Skill Drill', description: 'Student-led practice' },
  { value: 'documentation', label: 'Documentation', description: 'Documentation/PCR station' }
];

const STATION_TYPE_COLORS: Record<string, string> = {
  scenario: 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30',
  skill: 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/30',
  skills: 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/30',
  skill_drill: 'border-orange-200 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/30',
  documentation: 'border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/30',
  lecture: 'border-yellow-200 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/30',
  testing: 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/30',
};

const STATION_TYPE_BADGES: Record<string, string> = {
  scenario: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  skill: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  skills: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  skill_drill: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
  documentation: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  lecture: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  testing: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

export default function LabDayPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const labDayId = params.id as string;
  const justGraded = searchParams.get('graded');
  const openTimerParam = searchParams.get('timer') === 'open';

  const [labDay, setLabDay] = useState<LabDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTimer, setShowTimer] = useState(openTimerParam);
  const [labDayRoles, setLabDayRoles] = useState<LabDayRole[]>([]);
  const [stationSkillDocs, setStationSkillDocs] = useState<Record<string, SkillDocument[]>>({});

  // Role logging state
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleModalStation, setRoleModalStation] = useState<Station | null>(null);
  const [cohortStudents, setCohortStudents] = useState<Student[]>([]);
  const [scenarioParticipation, setScenarioParticipation] = useState<ScenarioParticipation[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({
    team_lead: '',
    med_tech: '',
    monitor_tech: '',
    airway_tech: '',
    observer: ''
  });
  const [savingRoles, setSavingRoles] = useState(false);

  // Duplicate lab day modal state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateDate, setDuplicateDate] = useState('');
  const [duplicating, setDuplicating] = useState(false);

  // Copy to Next Week state
  const [showNextWeekConfirm, setShowNextWeekConfirm] = useState(false);
  const [copyingNextWeek, setCopyingNextWeek] = useState(false);
  const [showDuplicateDropdown, setShowDuplicateDropdown] = useState(false);
  const [copySuccessToast, setCopySuccessToast] = useState(false);

  // Prep checklist state
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistCollapsed, setChecklistCollapsed] = useState(false);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistGenerating, setChecklistGenerating] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [addingChecklistItem, setAddingChecklistItem] = useState(false);

  // Equipment tracking state
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
  const [equipmentCollapsed, setEquipmentCollapsed] = useState(false);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [newEquipmentName, setNewEquipmentName] = useState('');
  const [newEquipmentQty, setNewEquipmentQty] = useState(1);
  const [newEquipmentStation, setNewEquipmentStation] = useState('');
  const [addingEquipment, setAddingEquipment] = useState(false);

  // Check-in toggle state
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false);

  // Edit station modal state
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [isCustomInstructor, setIsCustomInstructor] = useState(false);
  const [savingStation, setSavingStation] = useState(false);
  const [deletingStation, setDeletingStation] = useState(false);
  const [skillsModalOpen, setSkillsModalOpen] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');
  const [certLevelFilter, setCertLevelFilter] = useState<string>(''); // '' = All, 'EMT', 'AEMT', 'Paramedic'
  const [editCustomSkills, setEditCustomSkills] = useState<string[]>([]);
  const [stationInstructors, setStationInstructors] = useState<{id?: string; user_email: string; user_name: string; is_primary: boolean}[]>([]);
  const [editForm, setEditForm] = useState({
    station_type: 'scenario' as string,
    scenario_id: '',
    selectedSkills: [] as string[],
    custom_title: '',
    skill_sheet_url: '',
    instructions_url: '',
    station_notes: '',
    instructor_name: '',
    instructor_email: '',
    room: '',
    notes: ''
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && labDayId) {
      fetchLabDay();
      fetchScenarioParticipation();
      fetchChecklistItems();
      fetchEquipmentItems();
    }
  }, [session, labDayId]);

  // Fetch students when lab day is loaded
  useEffect(() => {
    if (labDay?.cohort?.id) {
      fetchCohortStudents();
    }
  }, [labDay?.cohort?.id]);

  const fetchChecklistItems = async () => {
    setChecklistLoading(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist`);
      const data = await res.json();
      if (data.success) {
        setChecklistItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching checklist items:', error);
    }
    setChecklistLoading(false);
  };

  const handleAutoGenerateChecklist = async () => {
    setChecklistGenerating(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto-generate' }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchChecklistItems();
      } else {
        alert('Failed to auto-generate checklist: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error auto-generating checklist:', error);
      alert('Failed to auto-generate checklist');
    }
    setChecklistGenerating(false);
  };

  const handleAddChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;
    setAddingChecklistItem(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newChecklistItem.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setChecklistItems(prev => [...prev, data.item]);
        setNewChecklistItem('');
      } else {
        alert('Failed to add item: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding checklist item:', error);
      alert('Failed to add checklist item');
    }
    setAddingChecklistItem(false);
  };

  const handleToggleChecklistItem = async (item: ChecklistItem) => {
    const newCompleted = !item.is_completed;
    // Optimistic update
    setChecklistItems(prev =>
      prev.map(i => i.id === item.id ? { ...i, is_completed: newCompleted } : i)
    );
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id, is_completed: newCompleted }),
      });
      const data = await res.json();
      if (data.success) {
        setChecklistItems(prev =>
          prev.map(i => i.id === item.id ? data.item : i)
        );
      } else {
        // Revert on failure
        setChecklistItems(prev =>
          prev.map(i => i.id === item.id ? { ...i, is_completed: item.is_completed } : i)
        );
      }
    } catch (error) {
      console.error('Error toggling checklist item:', error);
      // Revert on failure
      setChecklistItems(prev =>
        prev.map(i => i.id === item.id ? { ...i, is_completed: item.is_completed } : i)
      );
    }
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    // Optimistic update
    setChecklistItems(prev => prev.filter(i => i.id !== itemId));
    try {
      const res = await fetch(
        `/api/lab-management/lab-days/${labDayId}/checklist?itemId=${itemId}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!data.success) {
        // Revert by refetching
        await fetchChecklistItems();
      }
    } catch (error) {
      console.error('Error deleting checklist item:', error);
      await fetchChecklistItems();
    }
  };

  const fetchEquipmentItems = async () => {
    setEquipmentLoading(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/equipment`);
      const data = await res.json();
      if (data.success) {
        setEquipmentItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching equipment items:', error);
    }
    setEquipmentLoading(false);
  };

  const handleAddEquipmentItem = async () => {
    if (!newEquipmentName.trim()) return;
    setAddingEquipment(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newEquipmentName.trim(),
          quantity: newEquipmentQty,
          station_id: newEquipmentStation || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEquipmentItems(prev => [...prev, data.item]);
        setNewEquipmentName('');
        setNewEquipmentQty(1);
        setNewEquipmentStation('');
      } else {
        alert('Failed to add item: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding equipment item:', error);
      alert('Failed to add equipment item');
    }
    setAddingEquipment(false);
  };

  const handleUpdateEquipmentStatus = async (item: EquipmentItem, newStatus: EquipmentItem['status']) => {
    // Optimistic update
    setEquipmentItems(prev =>
      prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i)
    );
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/equipment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setEquipmentItems(prev =>
          prev.map(i => i.id === item.id ? data.item : i)
        );
      } else {
        // Revert
        setEquipmentItems(prev =>
          prev.map(i => i.id === item.id ? { ...i, status: item.status } : i)
        );
      }
    } catch (error) {
      console.error('Error updating equipment status:', error);
      setEquipmentItems(prev =>
        prev.map(i => i.id === item.id ? { ...i, status: item.status } : i)
      );
    }
  };

  const handleDeleteEquipmentItem = async (itemId: string) => {
    // Optimistic update
    setEquipmentItems(prev => prev.filter(i => i.id !== itemId));
    try {
      const res = await fetch(
        `/api/lab-management/lab-days/${labDayId}/equipment?itemId=${itemId}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!data.success) {
        await fetchEquipmentItems();
      }
    } catch (error) {
      console.error('Error deleting equipment item:', error);
      await fetchEquipmentItems();
    }
  };

  const fetchCohortStudents = async () => {
    if (!labDay?.cohort?.id) return;

    try {
      const res = await fetch(`/api/lab-management/students?cohortId=${labDay.cohort.id}&status=active`);
      const data = await res.json();
      if (data.success) {
        setCohortStudents(data.students || []);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchScenarioParticipation = async () => {
    try {
      const res = await fetch(`/api/tracking/scenarios?labDayId=${labDayId}`);
      const data = await res.json();
      if (data.success) {
        setScenarioParticipation(data.participation || []);
      }
    } catch (error) {
      console.error('Error fetching scenario participation:', error);
    }
  };

  const fetchLabDay = async () => {
    setLoading(true);
    try {
      const [labDayRes, instructorsRes, locationsRes, rolesRes] = await Promise.all([
        fetch(`/api/lab-management/lab-days/${labDayId}`),
        fetch('/api/lab-management/instructors'),
        fetch('/api/lab-management/locations?type=room'),
        fetch(`/api/lab-management/lab-day-roles?lab_day_id=${labDayId}`)
      ]);

      const labDayData = await labDayRes.json();
      const instructorsData = await instructorsRes.json();
      const locationsData = await locationsRes.json();
      const rolesData = await rolesRes.json();

      if (labDayData.success) {
        setLabDay(labDayData.labDay);
      } else {
        console.error('Failed to fetch lab day:', labDayData.error);
      }

      if (instructorsData.success) {
        setInstructors(instructorsData.instructors || []);
      }

      if (locationsData.success) {
        setLocations(locationsData.locations || []);
      }

      if (rolesData.success) {
        setLabDayRoles(rolesData.roles || []);
      }

      // Fetch station skill documents
      if (labDayData.success && labDayData.labDay?.stations) {
        // Fetch all skills with documents once
        const allSkillsRes = await fetch('/api/lab-management/skills?includeDocuments=true');
        const allSkillsData = await allSkillsRes.json();

        if (allSkillsData.success && allSkillsData.skills) {
          const skillsMap = new Map<string, Skill>();
          allSkillsData.skills.forEach((skill: Skill) => {
            skillsMap.set(skill.id, skill);
          });

          const skillDocsMap: Record<string, SkillDocument[]> = {};

          for (const station of labDayData.labDay.stations) {
            // Only fetch for skills or skill_drill stations
            if (station.station_type === 'skills' || station.station_type === 'skill_drill') {
              try {
                // Fetch station skills
                const stationSkillsRes = await fetch(`/api/lab-management/station-skills?stationId=${station.id}`);
                const stationSkillsData = await stationSkillsRes.json();

                if (stationSkillsData.success && stationSkillsData.stationSkills) {
                  const docs: SkillDocument[] = [];

                  // Collect documents from all linked skills
                  for (const stationSkill of stationSkillsData.stationSkills) {
                    if (stationSkill.skill?.id) {
                      const skill = skillsMap.get(stationSkill.skill.id);
                      if (skill?.documents) {
                        docs.push(...skill.documents);
                      }
                    }
                  }

                  skillDocsMap[station.id] = docs;
                }
              } catch (error) {
                console.error(`Error fetching skill documents for station ${station.id}:`, error);
              }
            }
          }

          setStationSkillDocs(skillDocsMap);
        }
      }
    } catch (error) {
      console.error('Error fetching lab day:', error);
    }
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    // Parse date string as local date to avoid timezone issues
    // Adding T12:00:00 ensures the date displays correctly in any timezone
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return null;
    // timeString is in "HH:MM" or "HH:MM:SS" format
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getStationTitle = (station: Station) => {
    // Prioritize custom_title as it contains the full descriptive name
    if (station.custom_title) return station.custom_title;
    // Fallback to scenario title or skill name
    if (station.scenario) return station.scenario.title;
    if (station.skill_name) return station.skill_name;
    return `Station ${station.station_number}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = document.getElementById('lab-day-printable');

    if (!element) {
      alert('Could not find printable content');
      return;
    }

    // Temporarily show print-only elements and hide screen-only elements
    const printHiddenElements = element.querySelectorAll('.print\\:hidden');
    const printBlockElements = element.querySelectorAll('.print\\:block');

    printHiddenElements.forEach(el => (el as HTMLElement).style.display = 'none');
    printBlockElements.forEach(el => (el as HTMLElement).style.display = 'block');

    const cohortName = `${labDay?.cohort.program.abbreviation}-G${labDay?.cohort.cohort_number}`;
    const dateStr = labDay?.date || new Date().toISOString().split('T')[0];

    const options = {
      margin: 0.5,
      filename: `lab-day-${cohortName}-${dateStr}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in' as const, format: 'letter', orientation: 'portrait' as const }
    };

    try {
      await html2pdf().set(options).from(element).save();
    } finally {
      // Restore visibility
      printHiddenElements.forEach(el => (el as HTMLElement).style.display = '');
      printBlockElements.forEach(el => (el as HTMLElement).style.display = '');
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateDate) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_date: duplicateDate })
      });
      const data = await res.json();
      if (data.success && data.newLabDayId) {
        setShowDuplicateModal(false);
        router.push(`/lab-management/schedule/${data.newLabDayId}/edit`);
      } else {
        alert('Failed to duplicate: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error duplicating lab day:', error);
      alert('An error occurred while duplicating the lab day.');
    }
    setDuplicating(false);
  };

  const getNextWeekDate = (): string => {
    if (!labDay?.date) return '';
    const d = new Date(labDay.date + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  };

  const handleCopyToNextWeek = async () => {
    const nextDate = getNextWeekDate();
    if (!nextDate) return;
    setCopyingNextWeek(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_date: nextDate })
      });
      const data = await res.json();
      if (data.success && data.newLabDayId) {
        setShowNextWeekConfirm(false);
        setCopySuccessToast(true);
        setTimeout(() => setCopySuccessToast(false), 3000);
        router.push(`/lab-management/schedule/${data.newLabDayId}/edit`);
      } else {
        alert('Failed to copy: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error copying lab day to next week:', error);
      alert('An error occurred while copying the lab day.');
    }
    setCopyingNextWeek(false);
  };

  const handleEnableCheckIn = async () => {
    setCheckInLoading(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checkin-token`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setLabDay(prev => prev ? {
          ...prev,
          checkin_token: data.checkin_token,
          checkin_enabled: true,
        } : prev);
      } else {
        alert('Failed to enable check-in: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error enabling check-in:', error);
      alert('An error occurred while enabling check-in.');
    }
    setCheckInLoading(false);
  };

  const handleDisableCheckIn = async () => {
    setCheckInLoading(true);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/checkin-token`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setLabDay(prev => prev ? { ...prev, checkin_enabled: false } : prev);
      } else {
        alert('Failed to disable check-in: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error disabling check-in:', error);
      alert('An error occurred while disabling check-in.');
    }
    setCheckInLoading(false);
  };

  const handleCopyCheckInLink = async () => {
    if (!labDay?.checkin_token) return;
    const url = `${window.location.origin}/checkin/${labDay.checkin_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyLinkSuccess(true);
      setTimeout(() => setCopyLinkSuccess(false), 2500);
    } catch {
      // Fallback: show the URL in an alert
      alert('Check-in URL: ' + url);
    }
  };

  const fetchScenariosAndSkills = async () => {
    try {
      const [scenariosRes, skillsRes] = await Promise.all([
        fetch('/api/lab-management/scenarios'),
        fetch('/api/lab-management/skills?includeDocuments=true')
      ]);
      const scenariosData = await scenariosRes.json();
      const skillsData = await skillsRes.json();
      if (scenariosData.success) {
        setScenarios(scenariosData.scenarios || []);
      }
      if (skillsData.success) {
        setSkills(skillsData.skills || []);
      }
    } catch (error) {
      console.error('Error fetching scenarios/skills:', error);
    }
  };

  const openEditModal = async (station: Station) => {
    setEditingStation(station);

    // Always fetch scenarios and skills FIRST to ensure they're available for rendering
    // This fixes a race condition where skills would appear empty in the edit form
    await fetchScenariosAndSkills();

    // Fetch station skills and custom skills if it's a skills station
    let stationSkillIds: string[] = [];
    let customSkillsList: string[] = [];

    if (station.station_type === 'skills' || station.station_type === 'skill_drill') {
      try {
        // Fetch library skills from station-skills endpoint
        const res = await fetch(`/api/lab-management/station-skills?stationId=${station.id}`);
        const data = await res.json();
        if (data.success && data.stationSkills) {
          stationSkillIds = data.stationSkills.map((ss: any) => ss.skill?.id || ss.skill_id).filter(Boolean);
        }

        // Fetch custom skills
        const customRes = await fetch(`/api/lab-management/custom-skills?stationId=${station.id}`);
        const customData = await customRes.json();
        if (customData.success && customData.customSkills) {
          customSkillsList = customData.customSkills.map((cs: any) => cs.name);
        }
      } catch (error) {
        console.error('Error fetching station skills:', error);
      }
    }

    setEditForm({
      station_type: station.station_type || 'scenario',
      scenario_id: station.scenario?.id || '',
      selectedSkills: stationSkillIds,
      custom_title: station.custom_title || '',
      skill_sheet_url: station.skill_sheet_url || '',
      instructions_url: station.instructions_url || '',
      station_notes: station.station_notes || '',
      instructor_name: station.instructor_name || '',
      instructor_email: station.instructor_email || '',
      room: station.room || '',
      notes: station.notes || ''
    });

    setEditCustomSkills(customSkillsList);

    // Fetch station instructors
    try {
      const instructorsRes = await fetch(`/api/lab-management/station-instructors?stationId=${station.id}`);
      const instructorsData = await instructorsRes.json();
      if (instructorsData.success && instructorsData.instructors) {
        setStationInstructors(instructorsData.instructors);
      } else {
        // Fallback to primary instructor from station
        if (station.instructor_name && station.instructor_email) {
          setStationInstructors([{
            user_email: station.instructor_email,
            user_name: station.instructor_name,
            is_primary: true
          }]);
        } else {
          setStationInstructors([]);
        }
      }
    } catch (error) {
      console.error('Error fetching station instructors:', error);
      // Fallback to primary instructor
      if (station.instructor_name && station.instructor_email) {
        setStationInstructors([{
          user_email: station.instructor_email,
          user_name: station.instructor_name,
          is_primary: true
        }]);
      } else {
        setStationInstructors([]);
      }
    }

    // Set selectedInstructor based on existing instructor data
    if (station.instructor_name && station.instructor_email) {
      const matchingInstructor = instructors.find(
        (i) => i.name === station.instructor_name && i.email === station.instructor_email
      );
      if (matchingInstructor) {
        setSelectedInstructor(`${matchingInstructor.name}|${matchingInstructor.email}`);
        setIsCustomInstructor(false);
      } else {
        // Custom instructor not in the list
        setSelectedInstructor('custom');
        setIsCustomInstructor(true);
      }
    } else if (station.instructor_name) {
      // Only has name, no email
      setSelectedInstructor('custom');
      setIsCustomInstructor(true);
    } else {
      setSelectedInstructor('');
      setIsCustomInstructor(false);
    }
  };

  const toggleSkill = (skillId: string) => {
    setEditForm(prev => ({
      ...prev,
      selectedSkills: prev.selectedSkills.includes(skillId)
        ? prev.selectedSkills.filter(id => id !== skillId)
        : [...prev.selectedSkills, skillId]
    }));
  };

  const assignSelf = () => {
    setEditForm(prev => ({
      ...prev,
      instructor_name: session?.user?.name || '',
      instructor_email: session?.user?.email || ''
    }));
    setSelectedInstructor(`${session?.user?.name}|${session?.user?.email}`);
    setIsCustomInstructor(false);
  };

  const handleInstructorChange = (value: string) => {
    setSelectedInstructor(value);

    if (value === 'custom') {
      setIsCustomInstructor(true);
      setEditForm(prev => ({
        ...prev,
        instructor_name: '',
        instructor_email: ''
      }));
    } else if (value === '') {
      setIsCustomInstructor(false);
      setEditForm(prev => ({
        ...prev,
        instructor_name: '',
        instructor_email: ''
      }));
    } else {
      setIsCustomInstructor(false);
      const [name, email] = value.split('|');
      setEditForm(prev => ({
        ...prev,
        instructor_name: name,
        instructor_email: email
      }));
    }
  };

  // Add instructor to station
  const addStationInstructor = async (name: string, email: string, isPrimary: boolean = false) => {
    if (!editingStation || !email.trim()) return;

    // Add to local state immediately for responsiveness
    const newInstructor = { user_email: email.trim(), user_name: name.trim() || email.split('@')[0], is_primary: isPrimary };

    // If setting as primary, unset existing primaries
    if (isPrimary) {
      setStationInstructors(prev => prev.map(i => ({ ...i, is_primary: false })));
    }

    // Check if already exists
    if (stationInstructors.some(i => i.user_email === email.trim())) {
      return;
    }

    setStationInstructors(prev => [...prev, newInstructor]);

    // Clear the form fields
    setEditForm(prev => ({ ...prev, instructor_name: '', instructor_email: '' }));
    setSelectedInstructor('');
    setIsCustomInstructor(false);
  };

  // Remove instructor from station
  const removeStationInstructor = (email: string) => {
    setStationInstructors(prev => prev.filter(i => i.user_email !== email));
  };

  // Set instructor as primary
  const setPrimaryInstructor = (email: string) => {
    setStationInstructors(prev => prev.map(i => ({
      ...i,
      is_primary: i.user_email === email
    })));
  };

  const addEditCustomSkill = () => {
    setEditCustomSkills([...editCustomSkills, '']);
  };

  const updateEditCustomSkill = (index: number, value: string) => {
    const updated = [...editCustomSkills];
    updated[index] = value;
    setEditCustomSkills(updated);
  };

  const removeEditCustomSkill = (index: number) => {
    setEditCustomSkills(editCustomSkills.filter((_, i) => i !== index));
  };

  // Group skills by category for the modal with certification level filter
  const filteredSkills = skills.filter(skill => {
    const matchesSearch = !skillSearch ||
      skill.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
      skill.category.toLowerCase().includes(skillSearch.toLowerCase());
    const matchesLevel = !certLevelFilter || skill.certification_levels?.includes(certLevelFilter);
    return matchesSearch && matchesLevel;
  });

  const skillsByCategory = filteredSkills.reduce((acc, skill) => {
    if (!acc[skill.category]) acc[skill.category] = [];
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  const closeEditModal = () => {
    setEditingStation(null);
  };

  const handleSaveStation = async () => {
    if (!editingStation) return;

    setSavingStation(true);
    try {
      // Auto-add selected instructor if user forgot to click (+)
      let workingInstructors = [...stationInstructors];
      if (selectedInstructor && selectedInstructor !== 'custom') {
        const [name, email] = selectedInstructor.split('|');
        if (!workingInstructors.some(i => i.user_email === email)) {
          workingInstructors.push({
            user_name: name,
            user_email: email,
            is_primary: workingInstructors.length === 0
          });
        }
      }
      // Also handle custom instructor fields
      if (isCustomInstructor && editForm.instructor_email && !workingInstructors.some(i => i.user_email === editForm.instructor_email)) {
        workingInstructors.push({
          user_name: editForm.instructor_name || editForm.instructor_email,
          user_email: editForm.instructor_email,
          is_primary: workingInstructors.length === 0
        });
      }

      // Get primary instructor for backwards compatibility
      const primaryInstructor = workingInstructors.find(i => i.is_primary) || workingInstructors[0];

      // Update station basic info
      const res = await fetch(`/api/lab-management/stations/${editingStation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_type: editForm.station_type,
          scenario_id: editForm.station_type === 'scenario' ? (editForm.scenario_id || null) : null,
          custom_title: editForm.custom_title || null,
          skill_sheet_url: editForm.skill_sheet_url || null,
          instructions_url: editForm.instructions_url || null,
          station_notes: editForm.station_notes || null,
          instructor_name: primaryInstructor?.user_name || null,
          instructor_email: primaryInstructor?.user_email || null,
          room: editForm.room || null,
          notes: editForm.notes || null
        })
      });

      const data = await res.json();
      if (!data.success) {
        alert('Failed to save: ' + (data.error || 'Unknown error'));
        setSavingStation(false);
        return;
      }

      // If skills or skill_drill station, update skill links and custom skills
      if (editForm.station_type === 'skills' || editForm.station_type === 'skill_drill') {
        // Delete existing skill links
        await fetch(`/api/lab-management/station-skills?stationId=${editingStation.id}`, {
          method: 'DELETE'
        });

        // Add new skill links
        for (const skillId of editForm.selectedSkills) {
          await fetch('/api/lab-management/station-skills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              station_id: editingStation.id,
              skill_id: skillId
            })
          });
        }

        // Delete existing custom skills
        const customSkillsRes = await fetch(`/api/lab-management/custom-skills?stationId=${editingStation.id}`);
        const customSkillsData = await customSkillsRes.json();
        if (customSkillsData.success && customSkillsData.customSkills) {
          for (const customSkill of customSkillsData.customSkills) {
            await fetch(`/api/lab-management/custom-skills?id=${customSkill.id}`, {
              method: 'DELETE'
            });
          }
        }

        // Add new custom skills
        for (const customSkill of editCustomSkills) {
          if (customSkill.trim()) {
            await fetch('/api/lab-management/custom-skills', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                station_id: editingStation.id,
                name: customSkill.trim()
              })
            });
          }
        }
      }

      // Save station instructors
      // First, get existing instructors to compare
      const existingRes = await fetch(`/api/lab-management/station-instructors?stationId=${editingStation.id}`);
      const existingData = await existingRes.json();
      const existingEmails = existingData.success ? existingData.instructors.map((i: any) => i.user_email) : [];

      // Remove instructors that are no longer in the list
      for (const email of existingEmails) {
        if (!workingInstructors.some(i => i.user_email === email)) {
          await fetch(`/api/lab-management/station-instructors?stationId=${editingStation.id}&userEmail=${encodeURIComponent(email)}`, {
            method: 'DELETE'
          });
        }
      }

      // Add or update instructors
      for (const instructor of workingInstructors) {
        await fetch('/api/lab-management/station-instructors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stationId: editingStation.id,
            userEmail: instructor.user_email,
            userName: instructor.user_name,
            isPrimary: instructor.is_primary
          })
        });
      }

      closeEditModal();
      fetchLabDay(); // Refresh the data
    } catch (error) {
      console.error('Error saving station:', error);
      alert('Failed to save station');
    }
    setSavingStation(false);
  };

  const handleDeleteStation = async () => {
    if (!editingStation) return;
    if (!confirm('Are you sure you want to delete this station? This cannot be undone.')) return;

    setDeletingStation(true);
    try {
      const res = await fetch(`/api/lab-management/stations/${editingStation.id}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        closeEditModal();
        fetchLabDay(); // Refresh the data
      } else {
        alert('Failed to delete: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting station:', error);
      alert('Failed to delete station');
    }
    setDeletingStation(false);
  };

  const openRoleModal = (station: Station) => {
    if (!station.scenario) return;

    setRoleModalStation(station);
    setShowRoleModal(true);

    // Pre-fill existing role assignments for this scenario on this lab day
    const existingRoles = scenarioParticipation.filter(
      sp => sp.scenario_id === station.scenario?.id && sp.lab_day_id === labDayId
    );

    const prefilledRoles: Record<string, string> = {
      team_lead: '',
      med_tech: '',
      monitor_tech: '',
      airway_tech: '',
      observer: ''
    };

    existingRoles.forEach(sp => {
      if (sp.role && sp.student_id) {
        prefilledRoles[sp.role] = sp.student_id;
      }
    });

    setRoleAssignments(prefilledRoles);
  };

  const closeRoleModal = () => {
    setShowRoleModal(false);
    setRoleModalStation(null);
    setRoleAssignments({
      team_lead: '',
      med_tech: '',
      monitor_tech: '',
      airway_tech: '',
      observer: ''
    });
  };

  const handleSaveRoles = async () => {
    if (!roleModalStation?.scenario || !labDay) return;

    setSavingRoles(true);
    try {
      const rolesToLog = Object.entries(roleAssignments).filter(([_, studentId]) => studentId);

      for (const [role, studentId] of rolesToLog) {
        await fetch('/api/tracking/scenarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: studentId,
            scenario_id: roleModalStation.scenario.id,
            scenario_name: roleModalStation.scenario.title,
            role: role,
            lab_day_id: labDayId,
            date: labDay.date
          })
        });
      }

      // Refresh participation data
      await fetchScenarioParticipation();
      closeRoleModal();

      // Show success message
      alert(`Successfully logged ${rolesToLog.length} role assignment(s)`);
    } catch (error) {
      console.error('Error saving roles:', error);
      alert('Failed to save roles');
    }
    setSavingRoles(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  if (!labDay) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Lab Day Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">The requested lab day could not be found.</p>
          <Link
            href="/lab-management/schedule"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Schedule
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div id="lab-day-printable" className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 print:bg-white">
      {/* Success Toast */}
      {justGraded && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in print:hidden">
          <Check className="w-5 h-5" />
          <span>Assessment saved successfully!</span>
        </div>
      )}

      {/* Copy to Next Week Toast */}
      {copySuccessToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in print:hidden">
          <Check className="w-5 h-5" />
          <span>Lab day copied to next week!</span>
        </div>
      )}

      {/* Print Header - Only visible when printing */}
      <div className="hidden print:block mb-4 p-4 border-b-2 border-gray-800">
        <h1 className="text-2xl font-bold text-center">LAB DAY SCHEDULE</h1>
        <div className="mt-2 flex justify-between text-sm">
          <div>
            <p><strong>Cohort:</strong> {labDay.cohort.program.abbreviation} Group {labDay.cohort.cohort_number}</p>
            <p><strong>Date:</strong> {formatDate(labDay.date)}</p>
            {(labDay.start_time || labDay.end_time) && (
              <p><strong>Time:</strong> {formatTime(labDay.start_time)}{labDay.end_time ? ` - ${formatTime(labDay.end_time)}` : ''}</p>
            )}
          </div>
          <div className="text-right">
            {labDay.week_number && labDay.day_number && (
              <p><strong>Week {labDay.week_number}, Day {labDay.day_number}</strong></p>
            )}
            <p>{labDay.num_rotations} rotations × {labDay.rotation_duration} min</p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
                <ChevronRight className="w-4 h-4" />
                <Link href="/lab-management/schedule" className="hover:text-blue-600 dark:hover:text-blue-400">Schedule</Link>
                <ChevronRight className="w-4 h-4" />
                <span>{labDay.cohort.program.abbreviation} Group {labDay.cohort.cohort_number}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {formatDate(labDay.date)}
              </h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                {(labDay.start_time || labDay.end_time) && (
                  <span className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                    <Clock className="w-4 h-4" />
                    {formatTime(labDay.start_time)}{labDay.end_time ? ` - ${formatTime(labDay.end_time)}` : ''}
                  </span>
                )}
                {labDay.week_number && labDay.day_number && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Week {labDay.week_number}, Day {labDay.day_number}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  {labDay.num_rotations} rotations × {labDay.rotation_duration} min
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 items-end print:hidden">
              {/* Inline timer widget — only visible when timer is active */}
              <InlineTimerWidget
                labDayId={labDayId}
                onOpenFullTimer={() => setShowTimer(true)}
              />
              <div className="flex gap-2">
              <button
                onClick={() => setShowTimer(true)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Timer className="w-4 h-4" />
                Start Timer
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              {/* Duplicate split button */}
              <div className="relative inline-flex">
                <button
                  onClick={() => {
                    setDuplicateDate('');
                    setShowDuplicateModal(true);
                    setShowDuplicateDropdown(false);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-l-lg hover:bg-gray-50 dark:hover:bg-gray-700 border-r-0"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
                <button
                  onClick={() => setShowDuplicateDropdown(prev => !prev)}
                  className="inline-flex items-center px-1.5 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-r-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  title="More duplicate options"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {showDuplicateDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowDuplicateDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                      <button
                        onClick={() => {
                          setShowDuplicateDropdown(false);
                          setShowNextWeekConfirm(true);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2"
                      >
                        <Calendar className="w-4 h-4 text-blue-500" />
                        Copy to Next Week
                      </button>
                    </div>
                  </>
                )}
              </div>
              <Link
                href={`/lab-management/schedule/${labDayId}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </Link>
              <Link
                href={`/lab-management/schedule/${labDayId}/stations/new`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Station
              </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Notes */}
        {labDay.notes && (
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-yellow-800 dark:text-yellow-300 mb-1">Notes</h3>
            <p className="text-yellow-700 dark:text-yellow-400 text-sm">{labDay.notes}</p>
          </div>
        )}

        {/* Lab Day Roles */}
        {labDayRoles.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 print:shadow-none print:border print:border-gray-300">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Lab Day Roles
            </h3>
            <div className="flex flex-wrap gap-4">
              {/* Lab Leads */}
              {labDayRoles.filter(r => r.role === 'lab_lead').length > 0 && (
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lab Lead</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {labDayRoles.filter(r => r.role === 'lab_lead').map(role => (
                      <span
                        key={role.id}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm font-medium"
                      >
                        {role.instructor?.name || 'Unknown'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Roamers */}
              {labDayRoles.filter(r => r.role === 'roamer').length > 0 && (
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Roamer</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {labDayRoles.filter(r => r.role === 'roamer').map(role => (
                      <span
                        key={role.id}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium"
                      >
                        {role.instructor?.name || 'Unknown'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Observers */}
              {labDayRoles.filter(r => r.role === 'observer').length > 0 && (
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Observer</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {labDayRoles.filter(r => r.role === 'observer').map(role => (
                      <span
                        key={role.id}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-sm font-medium"
                      >
                        {role.instructor?.name || 'Unknown'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stations Grid */}
        {labDay.stations.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Stations Yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Add stations to this lab day to get started.</p>
            <Link
              href={`/lab-management/schedule/${labDayId}/stations/new`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add First Station
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {labDay.stations.map((station) => (
              <div
                key={station.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow border-l-4 ${STATION_TYPE_COLORS[station.station_type] || 'border-gray-200 dark:border-gray-700'}`}
              >
                <div className="p-4">
                  {/* Station Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          Station {station.station_number}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATION_TYPE_BADGES[station.station_type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                          {station.station_type}
                        </span>
                        {station.platinum_required && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                            Platinum
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {getStationTitle(station)}
                      </h3>
                      {station.scenario && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{station.scenario.category}</p>
                      )}
                    </div>
                  </div>

                  {/* Station Details */}
                  <div className="space-y-2 text-sm mb-4">
                    {(station.instructor_name || station.instructor?.name) && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Users className="w-4 h-4" />
                        <span>{station.instructor_name || station.instructor?.name}</span>
                      </div>
                    )}
                    {(station.room || station.location) && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <MapPin className="w-4 h-4" />
                        <span>{station.room || station.location}</span>
                      </div>
                    )}
                    {station.documentation_required && (
                      <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                        <FileText className="w-4 h-4" />
                        <span>Documentation required</span>
                      </div>
                    )}
                  </div>

                  {/* Document Links */}
                  {(station.skill_sheet_url || station.instructions_url || (stationSkillDocs[station.id] && stationSkillDocs[station.id].length > 0)) && (
                    <div className="flex flex-wrap gap-2 mb-3 print:hidden">
                      {station.skill_sheet_url && (
                        <a
                          href={station.skill_sheet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        >
                          <FileText className="w-3 h-3" />
                          Skill Sheet
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {station.instructions_url && (
                        <a
                          href={station.instructions_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/50"
                        >
                          <FileText className="w-3 h-3" />
                          Instructions
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {stationSkillDocs[station.id] && stationSkillDocs[station.id].map((doc) => (
                        <a
                          key={doc.id}
                          href={doc.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50"
                        >
                          <FileText className="w-3 h-3" />
                          {doc.document_name}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t dark:border-gray-700 print:hidden">
                    <button
                      onClick={() => openEditModal(station)}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    {station.scenario && (
                      <>
                        <Link
                          href={`/lab-management/scenarios/${station.scenario.id}`}
                          className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <FileText className="w-4 h-4" />
                          Scenario
                        </Link>
                        <button
                          onClick={() => openRoleModal(station)}
                          className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <Users className="w-4 h-4" />
                          Log Roles
                        </button>
                      </>
                    )}
                    <Link
                      href={`/lab-management/grade/station/${station.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      Grade
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Prep Checklist */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow print:shadow-none print:border print:border-gray-300">
          {/* Checklist Header */}
          <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
            <button
              onClick={() => setChecklistCollapsed(prev => !prev)}
              className="flex items-center gap-2 text-left flex-1 min-w-0"
            >
              <ListChecks className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Prep Checklist</h3>
              {checklistItems.length > 0 && (
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 shrink-0">
                  {checklistItems.filter(i => i.is_completed).length}/{checklistItems.length} completed
                </span>
              )}
              {checklistItems.length > 0 && (
                <div className="ml-2 flex-1 max-w-xs bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((checklistItems.filter(i => i.is_completed).length / checklistItems.length) * 100)}%` }}
                  />
                </div>
              )}
              <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${checklistCollapsed ? '-rotate-90' : ''}`} />
            </button>
            <div className="flex items-center gap-2 ml-3 print:hidden">
              <button
                onClick={handleAutoGenerateChecklist}
                disabled={checklistGenerating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Generate checklist items from stations"
              >
                {checklistGenerating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Auto-Generate
              </button>
            </div>
          </div>

          {/* Checklist Body */}
          {!checklistCollapsed && (
            <div className="p-4">
              {checklistLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
                </div>
              ) : (
                <>
                  {/* Items list */}
                  {checklistItems.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      No checklist items yet. Click &quot;Auto-Generate&quot; to create items from stations, or add items manually below.
                    </p>
                  ) : (
                    <ul className="space-y-1 mb-4">
                      {checklistItems.map(item => (
                        <li
                          key={item.id}
                          className="flex items-center gap-3 group py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <button
                            onClick={() => handleToggleChecklistItem(item)}
                            className="shrink-0 text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors print:hidden"
                            aria-label={item.is_completed ? 'Mark incomplete' : 'Mark complete'}
                          >
                            {item.is_completed ? (
                              <CheckSquare className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                          {/* Print-only checkbox */}
                          <span className="hidden print:inline-block w-4 h-4 border border-gray-500 rounded-sm shrink-0" />
                          <span className={`flex-1 text-sm ${item.is_completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
                            {item.title}
                          </span>
                          {item.is_auto_generated && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 print:hidden shrink-0">auto</span>
                          )}
                          <button
                            onClick={() => handleDeleteChecklistItem(item.id)}
                            className="shrink-0 p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded print:hidden"
                            aria-label="Delete item"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Add item input */}
                  <div className="flex gap-2 print:hidden">
                    <input
                      type="text"
                      value={newChecklistItem}
                      onChange={e => setNewChecklistItem(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddChecklistItem(); }}
                      placeholder="Add a checklist item..."
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                    />
                    <button
                      onClick={handleAddChecklistItem}
                      disabled={addingChecklistItem || !newChecklistItem.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Equipment & Supplies */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow print:shadow-none print:border print:border-gray-300">
          {/* Equipment Header */}
          <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
            <button
              onClick={() => setEquipmentCollapsed(prev => !prev)}
              className="flex items-center gap-2 text-left flex-1 min-w-0"
            >
              <Package className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Equipment &amp; Supplies</h3>
              {equipmentItems.length > 0 && (
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 shrink-0">
                  {equipmentItems.filter(i => i.status === 'checked_out').length} out,{' '}
                  {equipmentItems.filter(i => i.status === 'returned').length} returned
                  {equipmentItems.filter(i => i.status === 'damaged' || i.status === 'missing').length > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      , {equipmentItems.filter(i => i.status === 'damaged' || i.status === 'missing').length} issues
                    </span>
                  )}
                </span>
              )}
              <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${equipmentCollapsed ? '-rotate-90' : ''}`} />
            </button>
          </div>

          {/* Equipment Body */}
          {!equipmentCollapsed && (
            <div className="p-4">
              {equipmentLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500"></div>
                </div>
              ) : (
                <>
                  {/* Summary badges */}
                  {equipmentItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4 print:hidden">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                        {equipmentItems.filter(i => i.status === 'checked_out').length} Checked Out
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        {equipmentItems.filter(i => i.status === 'returned').length} Returned
                      </span>
                      {equipmentItems.filter(i => i.status === 'damaged').length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                          {equipmentItems.filter(i => i.status === 'damaged').length} Damaged
                        </span>
                      )}
                      {equipmentItems.filter(i => i.status === 'missing').length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                          {equipmentItems.filter(i => i.status === 'missing').length} Missing
                        </span>
                      )}
                    </div>
                  )}

                  {/* Items list */}
                  {equipmentItems.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      No equipment tracked yet. Add items below to track checked-out supplies.
                    </p>
                  ) : (
                    <div className="mb-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">
                            <th className="pb-2 pr-4">Item</th>
                            <th className="pb-2 pr-4">Qty</th>
                            <th className="pb-2 pr-4">Station</th>
                            <th className="pb-2 pr-4">Status</th>
                            <th className="pb-2 print:hidden">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {equipmentItems.map(item => (
                            <tr key={item.id} className="group">
                              <td className="py-2 pr-4">
                                <div className="font-medium text-gray-900 dark:text-white">{item.name}</div>
                                {item.notes && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.notes}</div>
                                )}
                              </td>
                              <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{item.quantity}</td>
                              <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">
                                {item.station
                                  ? `Stn ${item.station.station_number}${item.station.custom_title ? ': ' + item.station.custom_title : ''}`
                                  : <span className="text-gray-300 dark:text-gray-600">—</span>
                                }
                              </td>
                              <td className="py-2 pr-4">
                                {item.status === 'checked_out' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                                    Checked Out
                                  </span>
                                )}
                                {item.status === 'returned' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                    Returned
                                  </span>
                                )}
                                {item.status === 'damaged' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                    Damaged
                                  </span>
                                )}
                                {item.status === 'missing' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                    Missing
                                  </span>
                                )}
                              </td>
                              <td className="py-2 print:hidden">
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {item.status !== 'returned' && (
                                    <button
                                      onClick={() => handleUpdateEquipmentStatus(item, 'returned')}
                                      title="Mark Returned"
                                      className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {item.status !== 'damaged' && (
                                    <button
                                      onClick={() => handleUpdateEquipmentStatus(item, 'damaged')}
                                      title="Mark Damaged"
                                      className="p-1 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded"
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {item.status !== 'missing' && (
                                    <button
                                      onClick={() => handleUpdateEquipmentStatus(item, 'missing')}
                                      title="Mark Missing"
                                      className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                    >
                                      <HelpCircle className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {item.status !== 'checked_out' && (
                                    <button
                                      onClick={() => handleUpdateEquipmentStatus(item, 'checked_out')}
                                      title="Mark Checked Out"
                                      className="p-1 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded"
                                    >
                                      <Package className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteEquipmentItem(item.id)}
                                    title="Remove item"
                                    className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 rounded ml-1"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Add item form */}
                  <div className="flex flex-wrap gap-2 print:hidden">
                    <input
                      type="text"
                      value={newEquipmentName}
                      onChange={e => setNewEquipmentName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddEquipmentItem(); }}
                      placeholder="Item name (e.g. BVM, AED trainer)"
                      className="flex-1 min-w-[180px] px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400"
                    />
                    <input
                      type="number"
                      min={1}
                      value={newEquipmentQty}
                      onChange={e => setNewEquipmentQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400"
                      title="Quantity"
                    />
                    <select
                      value={newEquipmentStation}
                      onChange={e => setNewEquipmentStation(e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400"
                    >
                      <option value="">No station</option>
                      {labDay.stations?.map(station => (
                        <option key={station.id} value={station.id}>
                          Stn {station.station_number}{station.custom_title ? ': ' + station.custom_title : station.scenario ? ': ' + station.scenario.title : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddEquipmentItem}
                      disabled={addingEquipment || !newEquipmentName.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Student Self Check-In */}
        {labDay.cohort?.id && (
          <div className="mt-6 print:hidden">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${labDay.checkin_enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <UserCheck className={`w-5 h-5 ${labDay.checkin_enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Student Self Check-In</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {labDay.checkin_enabled
                        ? 'Check-in is active — students can tap their name to mark themselves present.'
                        : 'Enable to give students a link to check themselves in.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={labDay.checkin_enabled ? handleDisableCheckIn : handleEnableCheckIn}
                  disabled={checkInLoading}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-colors disabled:opacity-50 ${
                    labDay.checkin_enabled
                      ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                  title={labDay.checkin_enabled ? 'Disable check-in' : 'Enable check-in'}
                >
                  {checkInLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : labDay.checkin_enabled ? (
                    <ToggleRight className="w-5 h-5" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" />
                  )}
                  {labDay.checkin_enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Check-in URL section — shown when enabled and token exists */}
              {labDay.checkin_enabled && labDay.checkin_token && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Check-In Link
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 min-w-0">
                      <Link2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-600 dark:text-gray-300 font-mono truncate">
                        {typeof window !== 'undefined' ? `${window.location.origin}/checkin/${labDay.checkin_token}` : `/checkin/${labDay.checkin_token}`}
                      </span>
                    </div>
                    <button
                      onClick={handleCopyCheckInLink}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-colors ${
                        copyLinkSuccess
                          ? 'bg-green-500 text-white'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {copyLinkSuccess ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy Link
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Share this link with students or display it on screen. They can tap their name to mark themselves present.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Student Attendance */}
        {labDay.cohort?.id && (
          <div className="mt-6 print:hidden">
            <AttendanceSection
              labDayId={labDayId}
              cohortId={labDay.cohort.id}
            />
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 flex flex-wrap gap-3 print:hidden">
          <Link
            href={`/lab-management/students?cohortId=${labDay.cohort.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Users className="w-4 h-4" />
            View Students
          </Link>
          <Link
            href={`/lab-management/reports/team-leads?cohortId=${labDay.cohort.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <ClipboardCheck className="w-4 h-4" />
            Team Lead Report
          </Link>
        </div>
      </main>

      {/* Edit Station Modal */}
      {editingStation && !skillsModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit Station {editingStation.station_number}
              </h2>
              <button
                onClick={closeEditModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Station Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Station Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STATION_TYPES.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, station_type: type.value }))}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        editForm.station_type === type.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-white">{type.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Station Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Station Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editForm.custom_title}
                    onChange={(e) => setEditForm(prev => ({ ...prev, custom_title: e.target.value }))}
                    placeholder="e.g., PM14 01/23/26 - Chest Pain Scenario"
                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!labDay) return;
                      const cohortAbbrev = labDay.cohort.program.abbreviation + labDay.cohort.cohort_number;
                      const dateStr = new Date(labDay.date + 'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
                      let suffix = '';
                      if (editForm.station_type === 'scenario' && editForm.scenario_id) {
                        const scenario = scenarios.find(s => s.id === editForm.scenario_id);
                        suffix = scenario ? scenario.title : 'Scenario';
                      } else if (editForm.station_type === 'skills' && editForm.selectedSkills.length > 0) {
                        const firstSkill = skills.find(s => s.id === editForm.selectedSkills[0]);
                        suffix = firstSkill ? (editForm.selectedSkills.length > 1 ? `${firstSkill.name} +${editForm.selectedSkills.length - 1}` : firstSkill.name) : 'Skills';
                      } else if (editForm.station_type === 'documentation') {
                        suffix = 'Documentation';
                      } else {
                        suffix = `Station ${editingStation?.station_number || ''}`;
                      }
                      setEditForm(prev => ({ ...prev, custom_title: `${cohortAbbrev} ${dateStr} - ${suffix}` }));
                    }}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm whitespace-nowrap"
                  >
                    Auto-generate
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Descriptive name shown on dashboard and schedule
                </p>
              </div>

              {/* Scenario Selection (for scenario type) */}
              {editForm.station_type === 'scenario' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Scenario
                  </label>
                  <select
                    value={editForm.scenario_id}
                    onChange={(e) => setEditForm(prev => ({ ...prev, scenario_id: e.target.value }))}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="">Select a scenario...</option>
                    {scenarios.map(scenario => (
                      <option key={scenario.id} value={scenario.id}>
                        {scenario.title} ({scenario.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Skill Drill Info */}
              {editForm.station_type === 'skill_drill' && (
                <div className="p-4 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                  <p className="text-orange-800 dark:text-orange-300 text-sm">
                    <strong>Skill Drill:</strong> Student-led practice station where students independently practice skills.
                    No instructor grading required.
                  </p>
                </div>
              )}

              {/* Skills Selection (for skills or skill_drill type) */}
              {(editForm.station_type === 'skills' || editForm.station_type === 'skill_drill') && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Skills from Library
                    </label>
                    <button
                      type="button"
                      onClick={() => setSkillsModalOpen(true)}
                      className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors"
                    >
                      <ClipboardCheck className="w-5 h-5 mx-auto mb-1" />
                      {editForm.selectedSkills.length > 0
                        ? `${editForm.selectedSkills.length} skills selected - Click to modify`
                        : 'Click to select skills from library'
                      }
                    </button>
                    {editForm.selectedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {editForm.selectedSkills.map(skillId => {
                          const skill = skills.find(s => s.id === skillId);
                          return skill ? (
                            <span key={skillId} className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-sm rounded">
                              {skill.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>

                  {/* Custom Skills */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Custom Skills
                    </label>
                    <div className="space-y-2">
                      {editCustomSkills.map((skill, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={skill}
                            onChange={(e) => updateEditCustomSkill(index, e.target.value)}
                            placeholder="Enter custom skill name"
                            className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                          />
                          <button
                            type="button"
                            onClick={() => removeEditCustomSkill(index)}
                            className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addEditCustomSkill}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add custom skill
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Documentation Info */}
              {editForm.station_type === 'documentation' && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <p className="text-blue-800 dark:text-blue-300 text-sm">
                    Documentation station for PCR practice and review. Instructor assignment is optional.
                  </p>
                </div>
              )}

              {/* BLS/Platinum Skills Checklist (for skills/skill_drill stations) */}
              {(editForm.station_type === 'skills' || editForm.station_type === 'skill_drill') && labDay && (
                <BLSPlatinumChecklist
                  labDayId={labDay.id}
                  currentStationId={editingStation?.id}
                  selectedSkillIds={editForm.selectedSkills}
                  onToggleSkill={(skillId) => {
                    setEditForm(prev => ({
                      ...prev,
                      selectedSkills: prev.selectedSkills.includes(skillId)
                        ? prev.selectedSkills.filter(id => id !== skillId)
                        : [...prev.selectedSkills, skillId]
                    }));
                  }}
                />
              )}

              {/* Station Documentation Section */}
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Station Documentation</h3>
                </div>

                {/* Auto-loaded documents from selected skills */}
                {(editForm.station_type === 'skills' || editForm.station_type === 'skill_drill') && editForm.selectedSkills.some(skillId => {
                  const skill = skills.find(s => s.id === skillId);
                  return skill?.documents && skill.documents.length > 0;
                }) && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                      <FileText className="w-3 h-3" />
                      Linked Skill Documents
                    </h4>
                    <div className="space-y-1">
                      {editForm.selectedSkills.flatMap(skillId => {
                        const skill = skills.find(s => s.id === skillId);
                        return (skill?.documents || []).map(doc => (
                          <a key={doc.id} href={doc.document_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 hover:underline">
                            <ExternalLink className="w-3 h-3" />
                            {doc.document_name}
                            <span className="text-xs text-blue-500 px-1 py-0.5 bg-blue-100 rounded">{doc.document_type}</span>
                          </a>
                        ));
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Skill Sheet URL
                  </label>
                  <input
                    type="url"
                    value={editForm.skill_sheet_url}
                    onChange={(e) => setEditForm(prev => ({ ...prev, skill_sheet_url: e.target.value }))}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Link to skill sheet or reference document
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Instructions URL
                  </label>
                  <input
                    type="url"
                    value={editForm.instructions_url}
                    onChange={(e) => setEditForm(prev => ({ ...prev, instructions_url: e.target.value }))}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Link to instructor instructions or setup guide
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Station Notes
                  </label>
                  <textarea
                    value={editForm.station_notes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, station_notes: e.target.value }))}
                    placeholder="Equipment needed, setup instructions, special considerations..."
                    rows={3}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Internal notes about station setup, equipment, or special requirements
                  </p>
                </div>
              </div>

              {/* Instructors */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Instructors
                </label>

                {/* Current instructors list */}
                {stationInstructors.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {stationInstructors.map((instructor) => (
                      <div
                        key={instructor.user_email}
                        className={`flex items-center justify-between p-2 rounded-lg ${
                          instructor.is_primary
                            ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                            : 'bg-gray-50 dark:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-white">{instructor.user_name}</span>
                          {instructor.is_primary && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {!instructor.is_primary && stationInstructors.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setPrimaryInstructor(instructor.user_email)}
                              className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                              title="Set as primary"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeStationInstructor(instructor.user_email)}
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            title="Remove instructor"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add instructor dropdown */}
                <div className="flex gap-2">
                  <select
                    value={selectedInstructor}
                    onChange={(e) => handleInstructorChange(e.target.value)}
                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="">Add instructor...</option>
                    {instructors
                      .filter(i => !stationInstructors.some(si => si.user_email === i.email))
                      .map((instructor) => (
                        <option key={instructor.id} value={`${instructor.name}|${instructor.email}`}>
                          {instructor.name}
                        </option>
                      ))}
                    <option value="custom">+ Custom name...</option>
                  </select>
                  {selectedInstructor && selectedInstructor !== 'custom' && (
                    <button
                      type="button"
                      onClick={() => {
                        const [name, email] = selectedInstructor.split('|');
                        addStationInstructor(name, email, stationInstructors.length === 0);
                      }}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {isCustomInstructor && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={editForm.instructor_name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, instructor_name: e.target.value }))}
                      placeholder="Name"
                      className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    />
                    <input
                      type="email"
                      value={editForm.instructor_email}
                      onChange={(e) => setEditForm(prev => ({ ...prev, instructor_email: e.target.value }))}
                      placeholder="Email"
                      className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (editForm.instructor_email) {
                          addStationInstructor(editForm.instructor_name, editForm.instructor_email, stationInstructors.length === 0);
                        }
                      }}
                      disabled={!editForm.instructor_email}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {stationInstructors.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (session?.user?.email && session?.user?.name) {
                        addStationInstructor(session.user.name, session.user.email, true);
                      }
                    }}
                    className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Users className="w-4 h-4" />
                    Assign myself
                  </button>
                )}
              </div>

              {/* Room */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Room / Location
                </label>
                <select
                  value={editForm.room}
                  onChange={(e) => setEditForm(prev => ({ ...prev, room: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select room...</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder="Special instructions, equipment needed, etc."
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between p-4 border-t dark:border-gray-700">
              <button
                onClick={handleDeleteStation}
                disabled={deletingStation}
                className="inline-flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
              >
                {deletingStation ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>

              <div className="flex gap-3">
                <button
                  onClick={closeEditModal}
                  className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveStation}
                  disabled={savingStation}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingStation ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lab Timer */}
      {showTimer && (
        <LabTimer
          labDayId={labDayId}
          numRotations={labDay.num_rotations}
          rotationMinutes={labDay.rotation_duration}
          onClose={() => setShowTimer(false)}
          isController={true}
        />
      )}

      {/* Skills Selection Modal */}
      {skillsModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Select Skills</h3>
              <button
                onClick={() => setSkillsModalOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Search and Filter */}
            <div className="p-4 border-b dark:border-gray-700 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  placeholder="Search skills..."
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
                <select
                  value={certLevelFilter}
                  onChange={(e) => setCertLevelFilter(e.target.value)}
                  className="px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="">All Levels</option>
                  <option value="EMT">EMT</option>
                  <option value="AEMT">AEMT</option>
                  <option value="Paramedic">Paramedic</option>
                </select>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{editForm.selectedSkills.length} selected</span>
                <span>{filteredSkills.length} skills shown</span>
              </div>
            </div>

            {/* Skills List */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                <div key={category} className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{category}</h4>
                  <div className="space-y-1">
                    {categorySkills.map(skill => {
                      const isSelected = editForm.selectedSkills.includes(skill.id);
                      return (
                        <label
                          key={skill.id}
                          className={`flex items-center gap-3 p-2 rounded cursor-pointer ${
                            isSelected ? 'bg-green-50 dark:bg-green-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSkill(skill.id)}
                            className="w-4 h-4 text-green-600"
                          />
                          <span className="text-sm text-gray-900 dark:text-white">{skill.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              {Object.keys(skillsByCategory).length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No skills found</p>
              )}
            </div>

            {/* Done Button */}
            <div className="p-4 border-t dark:border-gray-700">
              <button
                onClick={() => setSkillsModalOpen(false)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done ({editForm.selectedSkills.length} skills selected)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Logging Modal */}
      {showRoleModal && roleModalStation?.scenario && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Log Scenario Roles
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {roleModalStation.scenario.title}
                </p>
              </div>
              <button
                onClick={closeRoleModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Team Lead */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Team Lead
                </label>
                <select
                  value={roleAssignments.team_lead}
                  onChange={(e) => setRoleAssignments(prev => ({ ...prev, team_lead: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select student...</option>
                  {cohortStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.last_name}, {student.first_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Med Tech */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Med Tech
                </label>
                <select
                  value={roleAssignments.med_tech}
                  onChange={(e) => setRoleAssignments(prev => ({ ...prev, med_tech: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select student...</option>
                  {cohortStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.last_name}, {student.first_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Monitor Tech */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Monitor Tech
                </label>
                <select
                  value={roleAssignments.monitor_tech}
                  onChange={(e) => setRoleAssignments(prev => ({ ...prev, monitor_tech: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select student...</option>
                  {cohortStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.last_name}, {student.first_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Airway Tech */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Airway Tech
                </label>
                <select
                  value={roleAssignments.airway_tech}
                  onChange={(e) => setRoleAssignments(prev => ({ ...prev, airway_tech: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select student...</option>
                  {cohortStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.last_name}, {student.first_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Observer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Observer
                </label>
                <select
                  value={roleAssignments.observer}
                  onChange={(e) => setRoleAssignments(prev => ({ ...prev, observer: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select student...</option>
                  {cohortStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.last_name}, {student.first_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Previously logged roles for this scenario */}
              {scenarioParticipation.filter(sp =>
                sp.scenario_id === roleModalStation.scenario?.id &&
                sp.lab_day_id === labDayId
              ).length > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                  <h4 className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-2">
                    Previously Logged
                  </h4>
                  <div className="space-y-1 text-xs text-blue-700 dark:text-blue-400">
                    {scenarioParticipation
                      .filter(sp => sp.scenario_id === roleModalStation.scenario?.id && sp.lab_day_id === labDayId)
                      .map(sp => (
                        <div key={sp.id}>
                          {sp.role.replace(/_/g, ' ')}: {sp.student?.last_name}, {sp.student?.first_name}
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700">
              <button
                onClick={closeRoleModal}
                className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRoles}
                disabled={savingRoles || !Object.values(roleAssignments).some(v => v)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingRoles ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Log All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Lab Day Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Copy className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Duplicate Lab Day
              </h2>
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This will create a copy of <strong className="text-gray-900 dark:text-white">{labDay?.date ? formatDate(labDay.date) : 'this lab day'}</strong> with all its stations, skills, and configuration on a new date.
              </p>

              {labDay && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <p><span className="font-medium">Stations:</span> {labDay.stations?.length ?? 0}</p>
                  <p><span className="font-medium">Rotations:</span> {labDay.num_rotations} x {labDay.rotation_duration} min</p>
                  {labDay.title && <p><span className="font-medium">Title:</span> {labDay.title}</p>}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Date
                </label>
                <input
                  type="date"
                  value={duplicateDate}
                  onChange={e => setDuplicateDate(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700">
              <button
                onClick={() => setShowDuplicateModal(false)}
                disabled={duplicating}
                className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDuplicate}
                disabled={!duplicateDate || duplicating}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {duplicating ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {duplicating ? 'Duplicating...' : 'Duplicate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy to Next Week Confirm Dialog */}
      {showNextWeekConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Copy to Next Week
              </h2>
              <button
                onClick={() => setShowNextWeekConfirm(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Copy this lab day to{' '}
                <strong className="text-gray-900 dark:text-white">
                  {getNextWeekDate() ? formatDate(getNextWeekDate()) : 'next week'}
                </strong>
                ? All stations, skills, and configuration will be copied.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700">
              <button
                onClick={() => setShowNextWeekConfirm(false)}
                disabled={copyingNextWeek}
                className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCopyToNextWeek}
                disabled={copyingNextWeek}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {copyingNextWeek ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Calendar className="w-4 h-4" />
                )}
                {copyingNextWeek ? 'Copying...' : 'Copy to Next Week'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

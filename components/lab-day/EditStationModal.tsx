'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  ClipboardCheck,
  FileText,
  Users,
  Check,
  X,
  Save,
  Trash2,
  ExternalLink,
  Loader2,
  Upload,
  Link as LinkIcon,
  Clock,
} from 'lucide-react';
import BLSPlatinumChecklist from '@/components/BLSPlatinumChecklist';
import TemplateGuideSection from '@/components/TemplateGuideSection';
import type { StationMetadata } from '@/components/TemplateGuideSection';
import CalendarAvailabilityDot from '@/components/CalendarAvailabilityDot';
import type { Station, Scenario, Skill, Instructor, LabDay } from './types';
import { STATION_TYPES } from './types';
import { formatCohortNumber } from '@/lib/format-cohort';
import { useToast } from '@/components/Toast';
import { Session } from 'next-auth';

interface EditStationModalProps {
  station: Station;
  labDay: LabDay;
  instructors: Instructor[];
  locations: { id: string; name: string }[];
  calendarAvailability: Map<string, { status: 'free' | 'busy' | 'partial' | 'disconnected'; events: any[] }>;
  session: Session | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditStationModal({
  station,
  labDay,
  instructors,
  locations,
  calendarAvailability,
  session,
  onClose,
  onSaved,
}: EditStationModalProps) {
  const toast = useToast();

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [savingStation, setSavingStation] = useState(false);
  const [deletingStation, setDeletingStation] = useState(false);
  const [skillsModalOpen, setSkillsModalOpen] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');
  const [scenarioSearch, setScenarioSearch] = useState('');
  const [scenarioFilterCategory, setScenarioFilterCategory] = useState('');
  const [scenarioFilterDifficulty, setScenarioFilterDifficulty] = useState('');
  const [certLevelFilter, setCertLevelFilter] = useState<string>('');
  const [nremtOnlyFilter, setNremtOnlyFilter] = useState(false);
  const [editCustomSkills, setEditCustomSkills] = useState<string[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [isCustomInstructor, setIsCustomInstructor] = useState(false);
  const [stationInstructors, setStationInstructors] = useState<{id?: string; user_email: string; user_name: string; is_primary: boolean}[]>([]);
  const [editDrillData, setEditDrillData] = useState<Record<string, unknown> | null>(null);
  // Skill drill picker payload (from /api/lab-management/skill-drills →
  // skill_drills table). 2026-05-28: widened from {id,name,category}
  // to include program, semester, duration, and description so the
  // picker can render a richer card and operators can tell drills
  // apart at a glance. Imported drills (e.g. "Lifepack Monitor
  // Manipulation Drill") often have category=NULL but always have
  // program + semester from the import flow.
  const [editSkillDrills, setEditSkillDrills] = useState<{
    id: string;
    name: string;
    category: string | null;
    station_id?: string;
    program?: string | null;
    semester?: number | null;
    estimated_duration_minutes?: number | null;
    description?: string | null;
  }[]>([]);
  // Picker filter + search.
  const [drillSearch, setDrillSearch] = useState('');
  const [drillProgramFilter, setDrillProgramFilter] = useState<string>('');

  // Per-station ad-hoc documents (station_documents table) — added
  // 2026-05-28. Instructors can attach a PDF/DOCX/image OR a Drive
  // link directly to this one station, distinct from the canonical
  // skill_documents inherited from the parent skill.
  type StationDoc = {
    id: string;
    document_name: string;
    document_url: string;
    document_type: 'skill_sheet' | 'checkoff' | 'reference' | 'protocol';
    file_type: string | null;
    display_order: number;
  };
  const [stationDocs, setStationDocs] = useState<StationDoc[]>([]);
  const [docMode, setDocMode] = useState<'upload' | 'link'>('upload');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docUrl, setDocUrl] = useState('');
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState<'skill_sheet' | 'checkoff' | 'reference' | 'protocol'>('reference');
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    station_type: 'scenario' as string,
    scenario_id: '',
    selectedSkills: [] as string[],
    selectedDrillIds: [] as string[],
    custom_title: '',
    skill_sheet_url: '',
    instructions_url: '',
    station_notes: '',
    instructor_name: '',
    instructor_email: '',
    room: '',
    notes: '',
    rotation_minutes: '' as string | number,
    num_rotations: '' as string | number,
  });

  useEffect(() => {
    initModal();
  }, [station.id]);

  const initModal = async () => {
    // Fetch scenarios and skills
    await fetchScenariosAndSkills();
    // Load any ad-hoc documents already attached to this station.
    refreshStationDocs();

    // Fetch existing station_skills + custom_skills for this station.
    // 2026-04-18: widened from skills/skill_drill gate to any station
    // type so the picker can surface linked skills even on scenario /
    // procedural stations (prevents data loss when editing one of
    // those stations would have dropped skills silently).
    let stationSkillIds: string[] = [];
    let customSkillsList: string[] = [];

    {
      try {
        const res = await fetch(`/api/lab-management/station-skills?stationId=${station.id}`);
        const data = await res.json();
        if (data.success && data.stationSkills) {
          stationSkillIds = data.stationSkills.map((ss: any) => ss.skill?.id || ss.skill_id).filter(Boolean);
        }

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
      selectedDrillIds: Array.isArray(station.drill_ids) ? station.drill_ids : [],
      custom_title: station.custom_title || '',
      skill_sheet_url: station.skill_sheet_url || '',
      instructions_url: station.instructions_url || '',
      station_notes: station.station_notes || '',
      instructor_name: station.instructor_name || '',
      instructor_email: station.instructor_email || '',
      room: station.room || '',
      notes: station.notes || '',
      rotation_minutes: (station as { rotation_minutes?: number | null }).rotation_minutes ?? '',
      num_rotations: (station as { num_rotations?: number | null }).num_rotations ?? '',
    });

    setEditCustomSkills(customSkillsList);

    // Fetch drill data for skill_drill stations
    setEditDrillData(null);
    if (station.station_type === 'skill_drill') {
      if (station.metadata?.objectives || station.metadata?.instructor_guide) {
        setEditDrillData(station.metadata as Record<string, unknown>);
      }
      try {
        const drillsRes = await fetch('/api/lab-management/skill-drills');
        const drillsData = await drillsRes.json();
        if (drillsData.success) {
          setEditSkillDrills(drillsData.drills || []);
        }
      } catch (error) {
        console.error('Error fetching skill drills:', error);
      }
    }

    // Fetch station instructors
    try {
      const instructorsRes = await fetch(`/api/lab-management/station-instructors?stationId=${station.id}`);
      const instructorsData = await instructorsRes.json();
      if (instructorsData.success && instructorsData.instructors) {
        setStationInstructors(instructorsData.instructors);
      } else {
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
        setSelectedInstructor('custom');
        setIsCustomInstructor(true);
      }
    } else if (station.instructor_name) {
      setSelectedInstructor('custom');
      setIsCustomInstructor(true);
    } else {
      setSelectedInstructor('');
      setIsCustomInstructor(false);
    }
  };

  const fetchScenariosAndSkills = async () => {
    try {
      // MEGACODE sections (ACLS/PALS) need the cert scenario bank, which the
      // normal picker hides (cert_course IS NULL filter). Opt in with
      // includeCert and scope to this day's course so the ACLS scenarios are
      // selectable and an already-assigned one renders (not blank). Non-megacode
      // days keep the standard bank.
      const isMegacode = !!labDay?.is_adv_cert_testing || /megacode/i.test(labDay?.section_label || '');
      const scenarioUrl = isMegacode
        ? '/api/lab-management/scenarios?includeCert=true'
        : '/api/lab-management/scenarios';
      const [scenariosRes, skillsRes] = await Promise.all([
        fetch(scenarioUrl),
        fetch('/api/lab-management/skills?includeDocuments=true')
      ]);
      const scenariosData = await scenariosRes.json();
      const skillsData = await skillsRes.json();
      if (scenariosData.success) {
        let list = scenariosData.scenarios || [];
        if (isMegacode && labDay?.cert_course) {
          // Only this course's cert scenarios (don't show PALS on an ACLS day).
          list = list.filter((s: { cert_course?: string | null }) => s.cert_course === labDay.cert_course);
        }
        setScenarios(list);
      }
      if (skillsData.success) setSkills(skillsData.skills || []);
    } catch (error) {
      console.error('Error fetching scenarios/skills:', error);
    }
  };

  // ── Station document handlers ────────────────────────────────
  // Endpoints mirror the skill-documents API so a future shared
  // <DocumentManager> component could swap target URL only.

  const refreshStationDocs = async () => {
    try {
      const res = await fetch(`/api/lab-management/stations/${station.id}/documents`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setStationDocs(data.documents || []);
    } catch (error) {
      console.error('Error loading station docs:', error);
    }
  };

  const handleAddStationDoc = async () => {
    setDocError(null);
    if (docMode === 'upload' && !docFile) {
      setDocError('Choose a file to upload');
      return;
    }
    if (docMode === 'link' && !docUrl.trim()) {
      setDocError('Enter a URL');
      return;
    }
    if (!docName.trim() && docMode === 'link') {
      setDocError('Enter a name for this link');
      return;
    }

    setDocUploading(true);
    try {
      let res: Response;
      if (docMode === 'upload') {
        const fd = new FormData();
        fd.append('file', docFile as File);
        fd.append('documentName', docName.trim() || (docFile as File).name);
        fd.append('documentType', docType);
        res = await fetch(`/api/lab-management/stations/${station.id}/documents`, {
          method: 'POST',
          body: fd,
        });
      } else {
        res = await fetch(`/api/lab-management/stations/${station.id}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: docUrl.trim(),
            documentName: docName.trim(),
            documentType: docType,
          }),
        });
      }
      const data = await res.json();
      if (!data.success) {
        setDocError(data.error || 'Failed to add document');
        return;
      }
      // Reset form + refresh list.
      setDocFile(null);
      setDocUrl('');
      setDocName('');
      setDocType('reference');
      await refreshStationDocs();
      toast.success('Document added');
    } catch (error) {
      console.error('Error adding station doc:', error);
      setDocError('Network error while uploading');
    } finally {
      setDocUploading(false);
    }
  };

  const handleDeleteStationDoc = async (docId: string) => {
    if (!confirm('Remove this document?')) return;
    try {
      const res = await fetch(
        `/api/lab-management/stations/${station.id}/documents?documentId=${docId}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Failed to delete document');
        return;
      }
      await refreshStationDocs();
    } catch (error) {
      console.error('Error deleting station doc:', error);
      toast.error('Network error while deleting');
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

  const handleInstructorChange = (value: string) => {
    setSelectedInstructor(value);
    if (value === 'custom') {
      setIsCustomInstructor(true);
      setEditForm(prev => ({ ...prev, instructor_name: '', instructor_email: '' }));
    } else if (value === '') {
      setIsCustomInstructor(false);
      setEditForm(prev => ({ ...prev, instructor_name: '', instructor_email: '' }));
    } else {
      setIsCustomInstructor(false);
      const [name, email] = value.split('|');
      setEditForm(prev => ({ ...prev, instructor_name: name, instructor_email: email }));
    }
  };

  const addStationInstructor = async (name: string, email: string, isPrimary: boolean = false) => {
    if (!email.trim()) return;
    const newInstructor = { user_email: email.trim(), user_name: name.trim() || email.split('@')[0], is_primary: isPrimary };
    if (isPrimary) {
      setStationInstructors(prev => prev.map(i => ({ ...i, is_primary: false })));
    }
    if (stationInstructors.some(i => i.user_email === email.trim())) return;
    setStationInstructors(prev => [...prev, newInstructor]);
    setEditForm(prev => ({ ...prev, instructor_name: '', instructor_email: '' }));
    setSelectedInstructor('');
    setIsCustomInstructor(false);
  };

  const removeStationInstructor = (email: string) => {
    setStationInstructors(prev => prev.filter(i => i.user_email !== email));
  };

  const setPrimaryInstructor = (email: string) => {
    setStationInstructors(prev => prev.map(i => ({ ...i, is_primary: i.user_email === email })));
  };

  const isNremtDay = !!labDay.is_nremt_testing;

  const filteredSkills = skills.filter(skill => {
    const matchesSearch = !skillSearch ||
      skill.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
      skill.category.toLowerCase().includes(skillSearch.toLowerCase());
    const matchesLevel = !certLevelFilter || skill.certification_levels?.includes(certLevelFilter);
    const matchesNremt = !nremtOnlyFilter || skill.is_nremt;
    return matchesSearch && matchesLevel && matchesNremt;
  });

  // Sort NREMT skills to top when on an NREMT testing day
  const sortedSkills = isNremtDay
    ? [...filteredSkills].sort((a, b) => {
        if (a.is_nremt && !b.is_nremt) return -1;
        if (!a.is_nremt && b.is_nremt) return 1;
        return 0;
      })
    : filteredSkills;

  const skillsByCategory = isNremtDay
    ? (() => {
        const nremtSkills = sortedSkills.filter(s => s.is_nremt);
        const formativeSkills = sortedSkills.filter(s => !s.is_nremt);
        const groups: Record<string, Skill[]> = {};
        if (nremtSkills.length > 0) groups['NREMT Skills'] = nremtSkills;
        for (const skill of formativeSkills) {
          const cat = skill.category || 'Other';
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(skill);
        }
        return groups;
      })()
    : sortedSkills.reduce((acc, skill) => {
        if (!acc[skill.category]) acc[skill.category] = [];
        acc[skill.category].push(skill);
        return acc;
      }, {} as Record<string, Skill[]>);

  const handleSaveStation = async () => {
    // Warn if station_type changed from a gradeable type (may have evaluations)
    const originalType = station.station_type || 'scenario';
    if (editForm.station_type !== originalType && (originalType === 'skills' || originalType === 'scenario')) {
      const confirmed = window.confirm(
        'This station has a type that supports evaluations. Changing the type may affect how existing evaluations display. Continue?'
      );
      if (!confirmed) return;
    }

    setSavingStation(true);
    try {
      let workingInstructors = [...stationInstructors];
      if (selectedInstructor && selectedInstructor !== 'custom') {
        const [name, email] = selectedInstructor.split('|');
        if (!workingInstructors.some(i => i.user_email === email)) {
          workingInstructors.push({ user_name: name, user_email: email, is_primary: workingInstructors.length === 0 });
        }
      }
      if (isCustomInstructor && editForm.instructor_email && !workingInstructors.some(i => i.user_email === editForm.instructor_email)) {
        workingInstructors.push({ user_name: editForm.instructor_name || editForm.instructor_email, user_email: editForm.instructor_email, is_primary: workingInstructors.length === 0 });
      }

      const primaryInstructor = workingInstructors.find(i => i.is_primary) || workingInstructors[0];

      const res = await fetch(`/api/lab-management/stations/${station.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_type: editForm.station_type,
          scenario_id: editForm.station_type === 'scenario' ? (editForm.scenario_id || null) : null,
          drill_ids: editForm.station_type === 'skill_drill' && editForm.selectedDrillIds.length > 0 ? editForm.selectedDrillIds : null,
          custom_title: editForm.custom_title || null,
          skill_sheet_url: editForm.skill_sheet_url || null,
          instructions_url: editForm.instructions_url || null,
          station_notes: editForm.station_notes || null,
          instructor_name: primaryInstructor?.user_name || null,
          instructor_email: primaryInstructor?.user_email || null,
          room: editForm.room || null,
          notes: editForm.notes || null,
          rotation_minutes: editForm.rotation_minutes === '' ? null : Number(editForm.rotation_minutes),
          num_rotations: editForm.num_rotations === '' ? null : Number(editForm.num_rotations),
        })
      });

      const data = await res.json();
      if (!data.success) {
        alert('Failed to save: ' + (data.error || 'Unknown error'));
        setSavingStation(false);
        return;
      }

      // Persist station_skills + custom_skills for every station type
      // (2026-04-18: gate widened from skills/skill_drill). DELETE + re-POST
      // ensures removed skills get dropped. Unique (station_id, skill_id)
      // protects against double-inserts on retry.
      {
        await fetch(`/api/lab-management/station-skills?stationId=${station.id}`, { method: 'DELETE' });
        for (const skillId of editForm.selectedSkills) {
          await fetch('/api/lab-management/station-skills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ station_id: station.id, skill_id: skillId })
          });
        }

        const customSkillsRes = await fetch(`/api/lab-management/custom-skills?stationId=${station.id}`);
        const customSkillsData = await customSkillsRes.json();
        if (customSkillsData.success && customSkillsData.customSkills) {
          for (const customSkill of customSkillsData.customSkills) {
            await fetch(`/api/lab-management/custom-skills?id=${customSkill.id}`, { method: 'DELETE' });
          }
        }

        for (const customSkill of editCustomSkills) {
          if (customSkill.trim()) {
            await fetch('/api/lab-management/custom-skills', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ station_id: station.id, name: customSkill.trim() })
            });
          }
        }
      }

      // Save station instructors
      const existingRes = await fetch(`/api/lab-management/station-instructors?stationId=${station.id}`);
      const existingData = await existingRes.json();
      const existingEmails = existingData.success ? existingData.instructors.map((i: any) => i.user_email) : [];

      for (const email of existingEmails) {
        if (!workingInstructors.some(i => i.user_email === email)) {
          await fetch(`/api/lab-management/station-instructors?stationId=${station.id}&userEmail=${encodeURIComponent(email)}`, { method: 'DELETE' });
        }
      }

      for (const instructor of workingInstructors) {
        await fetch('/api/lab-management/station-instructors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stationId: station.id, userEmail: instructor.user_email, userName: instructor.user_name, isPrimary: instructor.is_primary })
        });
      }

      onSaved();
    } catch (error) {
      console.error('Error saving station:', error);
      alert('Failed to save station');
    }
    setSavingStation(false);
  };

  const handleDeleteStation = async () => {
    if (!confirm('Are you sure you want to delete this station? This cannot be undone.')) return;
    setDeletingStation(true);
    try {
      const res = await fetch(`/api/lab-management/stations/${station.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        onSaved();
      } else {
        alert('Failed to delete: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting station:', error);
      alert('Failed to delete station');
    }
    setDeletingStation(false);
  };

  // If skills modal is open, show that instead
  if (skillsModalOpen) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Select Skills</h3>
            <button onClick={() => setSkillsModalOpen(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

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
              <div className="flex items-center gap-3">
                {isNremtDay && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={nremtOnlyFilter}
                      onChange={(e) => setNremtOnlyFilter(e.target.checked)}
                      className="w-3.5 h-3.5 text-green-600 rounded"
                    />
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">Show NREMT skills only</span>
                  </label>
                )}
                <span>{filteredSkills.length} skills shown</span>
              </div>
            </div>
          </div>

          <div className="p-4 overflow-y-auto max-h-[50vh]">
            {Object.entries(skillsByCategory).map(([category, categorySkills], catIdx) => (
              <div key={category} className="mb-4">
                {isNremtDay && category !== 'NREMT Skills' && catIdx > 0 && Object.keys(skillsByCategory)[0] === 'NREMT Skills' && catIdx === 1 && (
                  <div className="border-t-2 border-gray-200 dark:border-gray-600 my-3 pt-1">
                    <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Formative Skills</span>
                  </div>
                )}
                <h4 className={`text-sm font-medium mb-2 ${
                  category === 'NREMT Skills'
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>{category}</h4>
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
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSkill(skill.id)} className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-gray-900 dark:text-white">{skill.name}</span>
                        {isNremtDay && skill.is_nremt && (
                          <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border border-green-300 dark:border-green-700">
                            NREMT ✓
                          </span>
                        )}
                        {isNremtDay && !skill.is_nremt && (
                          <span className="ml-auto text-xs px-2 py-0.5 text-gray-400 dark:text-gray-500">
                            (Formative)
                          </span>
                        )}
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

          <div className="p-4 border-t dark:border-gray-700">
            <button onClick={() => setSkillsModalOpen(false)} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Done ({editForm.selectedSkills.length} skills selected)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      {/* Widened from max-w-lg (~512px) to max-w-2xl (~672px) so the
          scenario picker has room to show a chief-complaint preview
          per row. Mobile still falls back via `w-full` + p-4 padding. */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Edit Station {station.station_number}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Station Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Station Type</label>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Station Name</label>
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
                  const cohortAbbrev = labDay.cohort.program.abbreviation + formatCohortNumber(labDay.cohort.cohort_number);
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
                    suffix = `Station ${station.station_number || ''}`;
                  }
                  setEditForm(prev => ({ ...prev, custom_title: `${cohortAbbrev} ${dateStr} - ${suffix}` }));
                }}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm whitespace-nowrap"
              >
                Auto-generate
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Descriptive name shown on dashboard and schedule</p>
          </div>

          {/* Scenario Selection */}
          {editForm.station_type === 'scenario' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scenario</label>
              {/* Search and filters */}
              <div className="space-y-2 mb-2">
                <input
                  type="text"
                  value={scenarioSearch}
                  onChange={(e) => setScenarioSearch(e.target.value)}
                  placeholder="Search scenarios by name..."
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                />
                <div className="flex gap-2">
                  <select
                    value={scenarioFilterCategory}
                    onChange={(e) => setScenarioFilterCategory(e.target.value)}
                    className="flex-1 px-2 py-1.5 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                  >
                    <option value="">All Categories</option>
                    {[...new Set(scenarios.map(s => s.category).filter(Boolean))].sort().map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <select
                    value={scenarioFilterDifficulty}
                    onChange={(e) => setScenarioFilterDifficulty(e.target.value)}
                    className="flex-1 px-2 py-1.5 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm"
                  >
                    <option value="">All Difficulties</option>
                    {[...new Set(scenarios.map(s => s.difficulty).filter(Boolean))].sort().map(diff => (
                      <option key={diff} value={diff}>{diff}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Scrollable scenario list. Taller (max-h-72) and
                  showing chief_complaint as a third line per row —
                  the wider modal makes this readable instead of
                  truncated to nothing. Helps tell apart same-named
                  scenarios that exist as duplicates or variants. */}
              <div className="max-h-72 overflow-y-auto border dark:border-gray-700 rounded-lg">
                {(() => {
                  const filtered = scenarios.filter(s => {
                    const q = scenarioSearch.toLowerCase();
                    const matchesSearch = !scenarioSearch ||
                      s.title.toLowerCase().includes(q) ||
                      s.category.toLowerCase().includes(q) ||
                      (s.chief_complaint ?? '').toLowerCase().includes(q);
                    const matchesCategory = !scenarioFilterCategory || s.category === scenarioFilterCategory;
                    const matchesDifficulty = !scenarioFilterDifficulty || s.difficulty === scenarioFilterDifficulty;
                    return matchesSearch && matchesCategory && matchesDifficulty;
                  });
                  if (filtered.length === 0) {
                    return (
                      <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                        No scenarios match your filters
                      </div>
                    );
                  }
                  return filtered.map(scenario => (
                    <label
                      key={scenario.id}
                      className={`flex items-start gap-3 p-2.5 cursor-pointer border-b last:border-0 dark:border-gray-700 transition-colors ${
                        editForm.scenario_id === scenario.id
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="scenario_select"
                        checked={editForm.scenario_id === scenario.id}
                        onChange={() => setEditForm(prev => ({ ...prev, scenario_id: scenario.id }))}
                        className="text-blue-600 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{scenario.title}</p>
                        {scenario.chief_complaint && (
                          <p className="text-xs text-gray-700 dark:text-gray-300 truncate">
                            {scenario.chief_complaint}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                            {scenario.category || 'uncat'}
                          </span>
                          {scenario.difficulty && (
                            <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                              scenario.difficulty.toLowerCase() === 'beginner'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                                : scenario.difficulty.toLowerCase() === 'intermediate'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                            }`}>
                              {scenario.difficulty}
                            </span>
                          )}
                          {scenario.estimated_duration != null && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              ~{scenario.estimated_duration} min
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ));
                })()}
              </div>
              {editForm.scenario_id && (
                <button
                  type="button"
                  onClick={() => setEditForm(prev => ({ ...prev, scenario_id: '' }))}
                  className="mt-1 text-xs text-gray-500 hover:text-red-500"
                >
                  Clear selection
                </button>
              )}
            </div>
          )}

          {/* Skill Drill Info + Picker
              Data source: /api/lab-management/skill-drills → skill_drills
              table (NOT the skills library that the BLS/Platinum
              checklist below uses). Imported drills via /admin/skill-drills/import
              land here. 2026-05-28: enriched the picker with program
              badge, duration chip, and description snippet so operators
              can spot a freshly-imported drill quickly. */}
          {editForm.station_type === 'skill_drill' && (
            <div className="space-y-3">
              <div className="p-4 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                <p className="text-orange-800 dark:text-orange-300 text-sm">
                  <strong>Skill Drill:</strong> Student-led practice station. Pick drills from the <Link href="/labs/skill-drills" className="underline" target="_blank">skill_drills library</Link>. To import new drills, go to <Link href="/admin/skill-drills/import" className="underline" target="_blank">/admin/skill-drills/import</Link>.
                </p>
              </div>

              {editForm.selectedDrillIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editForm.selectedDrillIds.map(id => {
                    const drill = editSkillDrills.find(d => d.id === id);
                    return drill ? (
                      <span key={id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-sm rounded-full">
                        {drill.name}
                        <button type="button" onClick={() => setEditForm(prev => ({ ...prev, selectedDrillIds: prev.selectedDrillIds.filter(did => did !== id) }))} className="hover:text-red-600">x</button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}

              {/* Picker filter row — search by name + program dropdown.
                  Keeps the imported-drill use-case fast: type "lifepack"
                  and the entry surfaces immediately regardless of where
                  it sits in the default category sort. */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={drillSearch}
                  onChange={(e) => setDrillSearch(e.target.value)}
                  placeholder="Search drills by name..."
                  className="flex-1 px-3 py-1.5 text-sm border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                />
                <select
                  value={drillProgramFilter}
                  onChange={(e) => setDrillProgramFilter(e.target.value)}
                  className="px-2 py-1.5 text-sm border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">All programs</option>
                  <option value="paramedic">Paramedic</option>
                  <option value="aemt">AEMT</option>
                  <option value="emt">EMT</option>
                </select>
              </div>

              {editSkillDrills.length > 0 ? (
                (() => {
                  const q = drillSearch.trim().toLowerCase();
                  const filtered = editSkillDrills.filter(d => {
                    if (drillProgramFilter && d.program !== drillProgramFilter) return false;
                    if (q && !d.name.toLowerCase().includes(q)) return false;
                    return true;
                  });
                  if (filtered.length === 0) {
                    return (
                      <div className="text-xs text-gray-500 dark:text-gray-400 italic p-3 border dark:border-gray-700 rounded-lg">
                        No drills match. Clear the filter or <Link href="/admin/skill-drills/import" className="underline">import more</Link>.
                      </div>
                    );
                  }
                  return (
                    <div className="max-h-72 overflow-y-auto border dark:border-gray-700 rounded-lg divide-y dark:divide-gray-700">
                      {filtered.map(drill => {
                        const isSelected = editForm.selectedDrillIds.includes(drill.id);
                        const programColor =
                          drill.program === 'paramedic' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                          drill.program === 'aemt' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                          drill.program === 'emt' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
                        const concept = (drill.description || '').slice(0, 80);
                        return (
                          <label
                            key={drill.id}
                            className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${isSelected ? 'bg-orange-50 dark:bg-orange-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => setEditForm(prev => ({
                                ...prev,
                                selectedDrillIds: isSelected
                                  ? prev.selectedDrillIds.filter(id => id !== drill.id)
                                  : [...prev.selectedDrillIds, drill.id]
                              }))}
                              className="mt-1 rounded border-gray-300 text-orange-600 focus:ring-orange-500 flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{drill.name}</span>
                                {drill.program && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${programColor}`}>
                                    {drill.program}{drill.semester ? ` S${drill.semester}` : ''}
                                  </span>
                                )}
                                {drill.estimated_duration_minutes ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 inline-flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" />
                                    {drill.estimated_duration_minutes} min
                                  </span>
                                ) : null}
                                {drill.category && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                    {drill.category}
                                  </span>
                                )}
                              </div>
                              {concept && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                  {concept}{(drill.description || '').length > 80 ? '…' : ''}
                                </p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                <div className="text-xs text-gray-500 dark:text-gray-400 italic p-3 border dark:border-gray-700 rounded-lg">
                  No drills in library yet. <Link href="/admin/skill-drills/import" className="underline">Import drills</Link>.
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {editForm.selectedDrillIds.length === 0 ? 'No drills selected.' : `${editForm.selectedDrillIds.length} drill${editForm.selectedDrillIds.length !== 1 ? 's' : ''} selected.`}
              </p>
            </div>
          )}

          {/* S3 Drill Guide */}
          {editForm.station_type === 'skill_drill' && editDrillData && Object.keys(editDrillData).length > 0 && (
            <TemplateGuideSection metadata={{
              objectives: editDrillData.objectives as string[] | undefined,
              student_instructions: editDrillData.student_instructions as string[] | undefined,
              instructor_guide: editDrillData.instructor_guide as StationMetadata['instructor_guide'],
              case_bank: editDrillData.case_bank as StationMetadata['case_bank'],
              rhythm_cases: editDrillData.rhythm_cases as StationMetadata['rhythm_cases'],
              minicode_phase_overlay: editDrillData.minicode_phase_overlay as StationMetadata['minicode_phase_overlay'],
              key_observations: editDrillData.key_observations as string[] | undefined,
              common_errors: editDrillData.common_errors as string[] | undefined,
              stress_layers_detailed: editDrillData.stress_layers_detailed as StationMetadata['stress_layers_detailed'],
              equipment: editDrillData.equipment as string[] | undefined,
            }} />
          )}

          {/* Template Guide */}
          {station.metadata && Object.keys(station.metadata).length > 0 && (
            <TemplateGuideSection metadata={station.metadata} />
          )}

          {/* Skills Selection — available for every station type so
              scenario / procedural stations can tag station_skills too. */}
          {true && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Skills from Library</label>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Custom Skills</label>
                <div className="space-y-2">
                  {editCustomSkills.map((skill, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={skill}
                        onChange={(e) => {
                          const updated = [...editCustomSkills];
                          updated[index] = e.target.value;
                          setEditCustomSkills(updated);
                        }}
                        placeholder="Enter custom skill name"
                        className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                      />
                      <button type="button" onClick={() => setEditCustomSkills(editCustomSkills.filter((_, i) => i !== index))} className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditCustomSkills([...editCustomSkills, ''])}
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

          {/* BLS/Platinum Checklist */}
          {(editForm.station_type === 'skills' || editForm.station_type === 'skill_drill') && labDay && (
            <BLSPlatinumChecklist
              labDayId={labDay.id}
              currentStationId={station.id}
              selectedSkillIds={editForm.selectedSkills}
              onToggleSkill={toggleSkill}
            />
          )}

          {/* Station Documentation Section */}
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Station Documentation</h3>
            </div>

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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Skill Sheet URL</label>
              <input type="url" value={editForm.skill_sheet_url} onChange={(e) => setEditForm(prev => ({ ...prev, skill_sheet_url: e.target.value }))} placeholder="https://drive.google.com/..." className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700" />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Link to skill sheet or reference document</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instructions URL</label>
              <input type="url" value={editForm.instructions_url} onChange={(e) => setEditForm(prev => ({ ...prev, instructions_url: e.target.value }))} placeholder="https://drive.google.com/..." className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700" />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Link to instructor instructions or setup guide</p>
            </div>

            {/* Ad-hoc Station Documents — list + add. Files upload
                to Supabase storage; links save as URL-only entries.
                Surfaces as indigo chips on StationCards. Distinct
                from skill_documents which are inherited from the
                skill definition and shown above as "Linked Skill
                Documents". */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Documents for this station
              </label>

              {stationDocs.length > 0 && (
                <ul className="space-y-1.5 mb-3">
                  {stationDocs.map(doc => (
                    <li key={doc.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                      <a
                        href={doc.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-indigo-700 dark:text-indigo-300 hover:underline min-w-0 flex-1"
                      >
                        <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{doc.document_name}</span>
                        <span className="text-[10px] px-1 py-0.5 bg-indigo-100 dark:bg-indigo-800/50 rounded uppercase flex-shrink-0">
                          {doc.file_type || doc.document_type}
                        </span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteStationDoc(doc.id)}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                        title="Remove document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 space-y-2 bg-white dark:bg-gray-800/40">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setDocMode('upload')}
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
                      docMode === 'upload'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload file
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocMode('link')}
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
                      docMode === 'link'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5" /> Link URL
                  </button>
                </div>

                {docMode === 'upload' ? (
                  <div>
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp,.gif"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setDocFile(f);
                        if (f && !docName) setDocName(f.name.replace(/\.[^.]+$/, ''));
                      }}
                      className="block w-full text-xs text-gray-600 dark:text-gray-400 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300"
                    />
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">PDF, DOCX, or image. Max 10 MB.</p>
                  </div>
                ) : (
                  <input
                    type="url"
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-600 rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                )}

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="Document name"
                    className="px-2 py-1.5 text-xs border dark:border-gray-600 rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as typeof docType)}
                    className="px-2 py-1.5 text-xs border dark:border-gray-600 rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="reference">Reference</option>
                    <option value="skill_sheet">Skill sheet</option>
                    <option value="checkoff">Checkoff</option>
                    <option value="protocol">Protocol</option>
                  </select>
                </div>

                {docError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{docError}</p>
                )}

                <button
                  type="button"
                  onClick={handleAddStationDoc}
                  disabled={docUploading}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded"
                >
                  {docUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" /> Add document
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Station Notes</label>
              <textarea value={editForm.station_notes} onChange={(e) => setEditForm(prev => ({ ...prev, station_notes: e.target.value }))} placeholder="Equipment needed, setup instructions, special considerations..." rows={3} className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700" />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Internal notes about station setup, equipment, or special requirements</p>
            </div>
          </div>

          {/* Instructors */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Instructors</label>

            {stationInstructors.length > 0 && (
              <div className="space-y-2 mb-3">
                {stationInstructors.map((instructor) => (
                  <div key={instructor.user_email} className={`flex items-center justify-between p-2 rounded-lg ${instructor.is_primary ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">{instructor.user_name}</span>
                      {instructor.user_email && calendarAvailability.has(instructor.user_email.toLowerCase()) && (
                        <CalendarAvailabilityDot status={calendarAvailability.get(instructor.user_email.toLowerCase())!.status} events={calendarAvailability.get(instructor.user_email.toLowerCase())!.events} size="md" />
                      )}
                      {instructor.is_primary && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded">Primary</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!instructor.is_primary && stationInstructors.length > 1 && (
                        <button type="button" onClick={() => setPrimaryInstructor(instructor.user_email)} className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" title="Set as primary">
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button type="button" onClick={() => removeStationInstructor(instructor.user_email)} className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400" title="Remove instructor">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <select value={selectedInstructor} onChange={(e) => handleInstructorChange(e.target.value)} className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700">
                <option value="">Add instructor...</option>
                {(() => {
                  const available = instructors.filter(i => !stationInstructors.some(si => si.user_email === i.email));
                  const staffInstructors = available.filter(i => i.role !== 'volunteer_instructor');
                  const volunteerInstructors = available.filter(i => i.role === 'volunteer_instructor');
                  const renderOption = (instructor: Instructor, suffix?: string) => {
                    const avail = instructor.email ? calendarAvailability.get(instructor.email.toLowerCase()) : undefined;
                    const dot = avail ? avail.status === 'free' ? '\u{1F7E2} ' : avail.status === 'partial' ? '\u{1F7E1} ' : avail.status === 'busy' ? '\u{1F534} ' : '\u26AA ' : '';
                    return (
                      <option key={instructor.id} value={`${instructor.name}|${instructor.email}`}>{dot}{instructor.name}{suffix || ''}</option>
                    );
                  };
                  return (
                    <>
                      {staffInstructors.length > 0 && (
                        <optgroup label="Instructors">
                          {staffInstructors.map(i => renderOption(i))}
                        </optgroup>
                      )}
                      {volunteerInstructors.length > 0 && (
                        <optgroup label="Volunteer Instructors">
                          {volunteerInstructors.map(i => renderOption(i, ' (Volunteer)'))}
                        </optgroup>
                      )}
                    </>
                  );
                })()}
                <option value="custom">+ Custom name...</option>
              </select>
              {selectedInstructor && selectedInstructor !== 'custom' && (
                <button type="button" onClick={() => { const [name, email] = selectedInstructor.split('|'); addStationInstructor(name, email, stationInstructors.length === 0); }} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Plus className="w-5 h-5" />
                </button>
              )}
            </div>

            {isCustomInstructor && (
              <div className="mt-3 flex gap-2">
                <input type="text" value={editForm.instructor_name} onChange={(e) => setEditForm(prev => ({ ...prev, instructor_name: e.target.value }))} placeholder="Name" className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700" />
                <input type="email" value={editForm.instructor_email} onChange={(e) => setEditForm(prev => ({ ...prev, instructor_email: e.target.value }))} placeholder="Email" className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700" />
                <button type="button" onClick={() => { if (editForm.instructor_email) addStationInstructor(editForm.instructor_name, editForm.instructor_email, stationInstructors.length === 0); }} disabled={!editForm.instructor_email} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            )}

            {stationInstructors.length === 0 && (
              <button type="button" onClick={() => { if (session?.user?.email && session?.user?.name) addStationInstructor(session.user.name, session.user.email, true); }} className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1">
                <Users className="w-4 h-4" />
                Assign myself
              </button>
            )}
          </div>

          {/* Room */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room / Location</label>
            <select value={editForm.room} onChange={(e) => setEditForm(prev => ({ ...prev, room: e.target.value }))} className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700">
              <option value="">Select room...</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.name}>{loc.name}</option>
              ))}
            </select>
          </div>

          {/* Rotation timing (per-station) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Minutes per rotation</label>
              <input type="number" min={0} value={editForm.rotation_minutes}
                onChange={(e) => setEditForm(prev => ({ ...prev, rotation_minutes: e.target.value }))}
                placeholder="e.g. 30"
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"># of rotations</label>
              <input type="number" min={0} value={editForm.num_rotations}
                onChange={(e) => setEditForm(prev => ({ ...prev, num_rotations: e.target.value }))}
                placeholder="e.g. 4"
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea value={editForm.notes} onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} placeholder="Special instructions, equipment needed, etc." className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700" />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between p-4 border-t dark:border-gray-700">
          <button onClick={handleDeleteStation} disabled={deletingStation} className="inline-flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50">
            {deletingStation ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
            <button onClick={handleSaveStation} disabled={savingStation} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {savingStation ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

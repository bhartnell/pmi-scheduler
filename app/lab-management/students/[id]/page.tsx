'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Edit2,
  Camera,
  Star,
  Calendar,
  ClipboardCheck,
  AlertCircle,
  Mail,
  Building,
  User,
  Trash2,
  Upload,
  FileCheck,
  Clock,
  BookOpen,
  Briefcase,
  Check,
  X,
  ExternalLink,
  Brain,
  Barcode as BarcodeIcon,
  TrendingUp,
  Flag,
  MessageSquare,
  Plus,
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
} from 'lucide-react';
import Barcode from 'react-barcode';
import { canManageStudentRoster, hasMinRole, type Role } from '@/lib/permissions';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  photo_url: string | null;
  status: string;
  agency: string | null;
  notes: string | null;
  created_at: string;
  team_lead_count: number;
  last_team_lead_date: string | null;
  prior_cert_level: string | null;
  years_ems_experience: number | null;
  prior_work_setting: string | null;
  prior_employer: string | null;
  scrub_top_size: string | null;
  scrub_bottom_size: string | null;
  student_id: string | null;
  cohort?: {
    id: string;
    cohort_number: number;
    program: {
      name: string;
      abbreviation: string;
    };
  };
}

interface TeamLeadEntry {
  id: string;
  date: string;
  lab_day: { date: string; week_number: number; day_number: number };
  lab_station: { station_number: number; station_type: string };
  scenario: { title: string; category: string } | null;
}

interface Assessment {
  id: string;
  assessed_at: string;
  assessment_score?: number;
  treatment_score?: number;
  communication_score?: number;
  skill_name?: string;
  overall_competency?: number;
}

interface ClinicalTasks {
  compliance: {
    completed: string[];
    total: number;
    percent: number;
  };
  internship: {
    id: string;
    status: string;
    currentPhase: number | null;
    agency: string | null;
    phase1Completed: boolean;
    phase2Completed: boolean;
  } | null;
  clinicalHours: {
    total: number;
    byDepartment: Record<string, number>;
  };
  mce: {
    completed: string[];
    total: number;
    percent: number;
  };
}

interface LearningStyle {
  id: string;
  student_id: string;
  primary_style: string;
  social_style: string;
  processing_style: string | null;
  structure_style: string | null;
  notes: string | null;
  assessed_date: string | null;
}

interface StudentNote {
  id: string;
  student_id: string;
  author_id: string;
  author_email: string | null;
  content: string;
  category: 'academic' | 'behavioral' | 'medical' | 'other';
  is_flagged: boolean;
  flag_level: 'yellow' | 'red' | null;
  created_at: string;
  updated_at: string;
  author: { id: string; name: string; email: string } | null;
}

interface ComplianceDocType {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean;
  expiration_months: number | null;
  sort_order: number;
  is_active: boolean;
}

interface ComplianceRecord {
  id: string;
  student_id: string;
  doc_type_id: string;
  status: 'complete' | 'missing' | 'expiring' | 'expired';
  expiration_date: string | null;
  file_path: string | null;
  file_name: string | null;
  notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ComplianceItem {
  doc_type: ComplianceDocType;
  record: ComplianceRecord | null;
  effective_status: 'complete' | 'missing' | 'expiring' | 'expired';
}

const REQUIRED_DOCS = ['mmr', 'vzv', 'hepb', 'tdap', 'covid', 'tb', 'physical', 'insurance', 'bls', 'flu', 'hospital_orient', 'background', 'drug_test'];
const MCE_MODULES = ['airway', 'respiratory', 'cardiovascular', 'trauma', 'medical', 'obstetrics', 'pediatrics', 'geriatrics', 'behavioral', 'toxicology', 'neurology', 'endocrine', 'immunology', 'infectious', 'operations'];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  graduated: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  withdrawn: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  on_hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const SCORE_COLORS: Record<number, string> = {
  0: 'bg-red-500',
  1: 'bg-orange-500',
  2: 'bg-yellow-500',
  3: 'bg-green-400',
  4: 'bg-green-600',
};

const CATEGORY_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  academic: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'Academic' },
  behavioral: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', label: 'Behavioral' },
  medical: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', label: 'Medical' },
  other: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', label: 'Other' },
};

const STYLE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  audio: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'Audio' },
  visual: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Visual' },
  kinesthetic: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', label: 'Kinesthetic' },
  social: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', label: 'Social' },
  independent: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', label: 'Independent' },
};

export default function StudentDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [student, setStudent] = useState<Student | null>(null);
  const [teamLeadHistory, setTeamLeadHistory] = useState<TeamLeadEntry[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [clinicalTasks, setClinicalTasks] = useState<ClinicalTasks | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);

  // Edit form state
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAgency, setEditAgency] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editNotes, setEditNotes] = useState('');
  const [editPriorCertLevel, setEditPriorCertLevel] = useState('');
  const [editYearsEmsExperience, setEditYearsEmsExperience] = useState('');
  const [editPriorWorkSetting, setEditPriorWorkSetting] = useState('');
  const [editPriorEmployer, setEditPriorEmployer] = useState('');
  const [editScrubTopSize, setEditScrubTopSize] = useState('');
  const [editScrubBottomSize, setEditScrubBottomSize] = useState('');
  const [editStudentId, setEditStudentId] = useState('');

  // Learning style state
  const [learningStyle, setLearningStyle] = useState<LearningStyle | null>(null);
  const [editingLearningStyle, setEditingLearningStyle] = useState(false);
  const [savingLearningStyle, setSavingLearningStyle] = useState(false);
  const [lsPrimaryStyle, setLsPrimaryStyle] = useState('');
  const [lsSocialStyle, setLsSocialStyle] = useState('');
  const [lsNotes, setLsNotes] = useState('');

  // Notes state
  const [studentNotes, setStudentNotes] = useState<StudentNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'compliance' | 'lab-ratings'>('overview');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // New note form
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState<'academic' | 'behavioral' | 'medical' | 'other'>('other');
  const [newNoteFlagLevel, setNewNoteFlagLevel] = useState<'yellow' | 'red' | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  // Edit note state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  const [editNoteCategory, setEditNoteCategory] = useState<'academic' | 'behavioral' | 'medical' | 'other'>('other');
  const [editNoteFlagLevel, setEditNoteFlagLevel] = useState<'yellow' | 'red' | null>(null);
  const [savingEditNote, setSavingEditNote] = useState(false);

  // Compliance state
  const [complianceItems, setComplianceItems] = useState<ComplianceItem[]>([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceSaving, setComplianceSaving] = useState<string | null>(null);
  const [complianceEditId, setComplianceEditId] = useState<string | null>(null);
  const [complianceEditExpDate, setComplianceEditExpDate] = useState('');
  const [complianceEditNotes, setComplianceEditNotes] = useState('');
  const [complianceEditStatus, setComplianceEditStatus] = useState<'complete' | 'missing' | 'expiring' | 'expired'>('complete');
  const [complianceVerifying, setComplianceVerifying] = useState<string | null>(null);

  // Lab ratings state
  const [labRatings, setLabRatings] = useState<any[]>([]);
  const [labRatingsAverage, setLabRatingsAverage] = useState<number | null>(null);
  const [labRatingsTotal, setLabRatingsTotal] = useState(0);
  const [labRatingsLoading, setLabRatingsLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && studentId) {
      fetchStudent();
      fetchTeamLeadHistory();
      fetchAssessments();
      fetchClinicalTasks();
      fetchCurrentUser();
      fetchLearningStyle();
      fetchNotes();
      fetchCompliance();
      fetchLabRatings();
    }
  }, [session, studentId]);

  // Paste from clipboard event listener
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle paste if we're not in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await uploadPhotoFile(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [studentId]); // Re-attach if studentId changes

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setUserRole(data.user.role);
        setCurrentUserId(data.user.id);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchNotes = async () => {
    setNotesLoading(true);
    try {
      const res = await fetch(`/api/lab-management/students/${studentId}/notes`);
      const data = await res.json();
      if (data.success) {
        setStudentNotes(data.notes || []);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
    setNotesLoading(false);
  };

  const fetchStudent = async () => {
    try {
      const res = await fetch(`/api/lab-management/students/${studentId}`);
      const data = await res.json();
      if (data.success) {
        setStudent(data.student);
        // Populate edit form
        setEditFirstName(data.student.first_name);
        setEditLastName(data.student.last_name);
        setEditEmail(data.student.email || '');
        setEditAgency(data.student.agency || '');
        setEditStatus(data.student.status);
        setEditNotes(data.student.notes || '');
        setEditPriorCertLevel(data.student.prior_cert_level || '');
        setEditYearsEmsExperience(data.student.years_ems_experience?.toString() || '');
        setEditPriorWorkSetting(data.student.prior_work_setting || '');
        setEditPriorEmployer(data.student.prior_employer || '');
        setEditScrubTopSize(data.student.scrub_top_size || '');
        setEditScrubBottomSize(data.student.scrub_bottom_size || '');
        setEditStudentId(data.student.student_id || '');
      }
    } catch (error) {
      console.error('Error fetching student:', error);
    }
    setLoading(false);
  };

  const fetchTeamLeadHistory = async () => {
    try {
      const res = await fetch(`/api/lab-management/team-leads?studentId=${studentId}`);
      const data = await res.json();
      if (data.success) {
        setTeamLeadHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching TL history:', error);
    }
  };

  const fetchAssessments = async () => {
    try {
      // Fetch scenario assessments where student was team lead
      const scenarioRes = await fetch(`/api/lab-management/assessments/scenario?studentId=${studentId}`);
      const scenarioData = await scenarioRes.json();
      
      // Fetch skill assessments for this student
      const skillRes = await fetch(`/api/lab-management/assessments/skill?studentId=${studentId}`);
      const skillData = await skillRes.json();
      
      const allAssessments = [
        ...(scenarioData.success ? scenarioData.assessments : []),
        ...(skillData.success ? skillData.assessments : []),
      ].sort((a, b) => new Date(b.assessed_at).getTime() - new Date(a.assessed_at).getTime());
      
      setAssessments(allAssessments.slice(0, 10)); // Last 10
    } catch (error) {
      console.error('Error fetching assessments:', error);
    }
  };

  const fetchClinicalTasks = async () => {
    try {
      const res = await fetch(`/api/lab-management/students/${studentId}/clinical-tasks`);
      const data = await res.json();
      if (data.success) {
        setClinicalTasks(data.tasks);
      }
    } catch (error) {
      console.error('Error fetching clinical tasks:', error);
    }
  };

  const fetchLearningStyle = async () => {
    try {
      const res = await fetch(`/api/seating/learning-styles?studentId=${studentId}`);
      const data = await res.json();
      if (data.success && data.learningStyles?.length > 0) {
        const ls = data.learningStyles[0];
        setLearningStyle(ls);
        setLsPrimaryStyle(ls.primary_style || '');
        setLsSocialStyle(ls.social_style || '');
        setLsNotes(ls.notes || '');
      }
    } catch (error) {
      console.error('Error fetching learning style:', error);
    }
  };

  const fetchCompliance = async () => {
    setComplianceLoading(true);
    try {
      const res = await fetch(`/api/compliance?student_id=${studentId}`);
      const data = await res.json();
      if (data.success) {
        setComplianceItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching compliance:', error);
    }
    setComplianceLoading(false);
  };

  const fetchLabRatings = async () => {
    setLabRatingsLoading(true);
    try {
      const res = await fetch(`/api/lab-management/students/${studentId}/ratings`);
      const data = await res.json();
      if (data.success) {
        setLabRatings(data.ratings || []);
        setLabRatingsAverage(data.averageRating);
        setLabRatingsTotal(data.totalCount || 0);
      }
    } catch (error) {
      console.error('Error fetching lab ratings:', error);
    }
    setLabRatingsLoading(false);
  };

  const handleSaveCompliance = async (docTypeId: string) => {
    setComplianceSaving(docTypeId);
    try {
      const res = await fetch('/api/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          doc_type_id: docTypeId,
          status: complianceEditStatus,
          expiration_date: complianceEditExpDate || null,
          notes: complianceEditNotes || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchCompliance();
        setComplianceEditId(null);
      } else {
        alert('Failed to save: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving compliance:', error);
      alert('Failed to save compliance document');
    }
    setComplianceSaving(null);
  };

  const handleVerifyCompliance = async (recordId: string) => {
    setComplianceVerifying(recordId);
    try {
      const res = await fetch('/api/compliance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: recordId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchCompliance();
      } else {
        alert('Failed to verify: ' + data.error);
      }
    } catch (error) {
      console.error('Error verifying compliance:', error);
      alert('Failed to verify document');
    }
    setComplianceVerifying(null);
  };

  const openComplianceEdit = (item: ComplianceItem) => {
    setComplianceEditId(item.doc_type.id);
    setComplianceEditStatus(item.record?.status || 'complete');
    setComplianceEditExpDate(item.record?.expiration_date || '');
    setComplianceEditNotes(item.record?.notes || '');
  };

  const handleSaveLearningStyle = async () => {
    if (!lsPrimaryStyle || !lsSocialStyle) {
      alert('Please select both primary and social learning styles');
      return;
    }

    setSavingLearningStyle(true);
    try {
      const res = await fetch('/api/seating/learning-styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          primary_style: lsPrimaryStyle,
          social_style: lsSocialStyle,
          notes: lsNotes || null,
        }),
      });

      if (res.ok) {
        await fetchLearningStyle();
        setEditingLearningStyle(false);
      } else {
        alert('Failed to save learning style');
      }
    } catch (error) {
      console.error('Error saving learning style:', error);
      alert('Error saving learning style');
    }
    setSavingLearningStyle(false);
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/lab-management/students/${studentId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newNoteContent,
          category: newNoteCategory,
          flag_level: newNoteFlagLevel,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStudentNotes(prev => [data.note, ...prev]);
        setNewNoteContent('');
        setNewNoteCategory('other');
        setNewNoteFlagLevel(null);
      } else {
        alert('Failed to save note: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note');
    }
    setSavingNote(false);
  };

  const handleStartEditNote = (note: StudentNote) => {
    setEditingNoteId(note.id);
    setEditNoteContent(note.content);
    setEditNoteCategory(note.category);
    setEditNoteFlagLevel(note.flag_level);
  };

  const handleSaveEditNote = async () => {
    if (!editingNoteId || !editNoteContent.trim()) return;
    setSavingEditNote(true);
    try {
      const res = await fetch(`/api/lab-management/students/${studentId}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId: editingNoteId,
          content: editNoteContent,
          category: editNoteCategory,
          flag_level: editNoteFlagLevel,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStudentNotes(prev => prev.map(n => n.id === editingNoteId ? data.note : n));
        setEditingNoteId(null);
      } else {
        alert('Failed to update note: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating note:', error);
      alert('Failed to update note');
    }
    setSavingEditNote(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note? This cannot be undone.')) return;
    try {
      const res = await fetch(
        `/api/lab-management/students/${studentId}/notes?noteId=${noteId}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) {
        setStudentNotes(prev => prev.filter(n => n.id !== noteId));
      } else {
        alert('Failed to delete note: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note');
    }
  };

  // Compute highest active flag level for this student
  const highestFlagLevel: 'yellow' | 'red' | null = studentNotes.reduce(
    (highest, note) => {
      if (!note.is_flagged) return highest;
      if (note.flag_level === 'red') return 'red';
      if (note.flag_level === 'yellow' && highest !== 'red') return 'yellow';
      return highest;
    },
    null as 'yellow' | 'red' | null
  );

  const formatRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  // Upload photo from File object (used by file input, drag-drop, and paste)
  const uploadPhotoFile = async (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please select a JPG, PNG, or WebP image');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/lab-management/students/${studentId}/photo`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setStudent(prev => prev ? { ...prev, photo_url: data.photoUrl } : null);
      } else {
        alert('Failed to upload photo: ' + data.error);
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo');
    }
    setUploading(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadPhotoFile(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadPhotoFile(file);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/lab-management/students/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: editFirstName,
          last_name: editLastName,
          email: editEmail || null,
          agency: editAgency || null,
          status: editStatus,
          notes: editNotes || null,
          prior_cert_level: editPriorCertLevel || null,
          years_ems_experience: editYearsEmsExperience ? parseFloat(editYearsEmsExperience) : null,
          prior_work_setting: editPriorWorkSetting || null,
          prior_employer: editPriorEmployer || null,
          scrub_top_size: editScrubTopSize || null,
          scrub_bottom_size: editScrubBottomSize || null,
          student_id: editStudentId || null,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setStudent(data.student);
        setEditing(false);
      } else {
        alert('Failed to save: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${student?.first_name} ${student?.last_name}? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/lab-management/students/${studentId}`, {
        method: 'DELETE',
      });
      
      const data = await res.json();
      if (data.success) {
        router.push('/lab-management/students');
      } else {
        alert('Failed to delete: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Failed to delete');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Student Not Found</h2>
          <Link href="/lab-management/students" className="text-blue-600 dark:text-blue-400 hover:underline">Back to Students</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/students" className="hover:text-blue-600 dark:hover:text-blue-400">Students</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300">{student.first_name} {student.last_name}</span>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Profile Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Photo */}
            <div className="flex flex-col items-center">
              <div
                onClick={handlePhotoClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative w-32 h-32 rounded-full overflow-hidden cursor-pointer group transition-all ${
                  dragActive
                    ? 'bg-blue-100 dark:bg-blue-900 border-4 border-blue-500 border-dashed scale-105'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                {student.photo_url ? (
                  <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-4xl font-bold text-gray-400 dark:text-gray-500">
                      {student.first_name[0]}{student.last_name[0]}
                    </span>
                  </div>
                )}
                <div className={`absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center transition-opacity ${
                  dragActive || uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  {uploading ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  ) : dragActive ? (
                    <>
                      <Upload className="w-8 h-8 text-white mb-1" />
                      <span className="text-white text-xs font-medium">Drop photo</span>
                    </>
                  ) : (
                    <Camera className="w-8 h-8 text-white" />
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                onClick={handlePhotoClick}
                className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
              >
                <Upload className="w-4 h-4" />
                {student.photo_url ? 'Change Photo' : 'Add Photo'}
              </button>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-center">
                Drag & drop, paste (Ctrl+V), or click
              </p>
            </div>

            {/* Info */}
            <div className="flex-1">
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                      <input type="text" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                      <input type="text" value={editLastName} onChange={e => setEditLastName(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agency</label>
                      <input type="text" value={editAgency} onChange={e => setEditAgency(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                      <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700">
                        <option value="active">Active</option>
                        <option value="graduated">Graduated</option>
                        <option value="withdrawn">Withdrawn</option>
                        <option value="on_hold">On Hold</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                    <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700" />
                  </div>

                  {/* EMS Background (Optional) */}
                  <div className="pt-4 border-t dark:border-gray-600">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">EMS Background (Optional)</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prior Certification Level</label>
                        <select value={editPriorCertLevel} onChange={e => setEditPriorCertLevel(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700">
                          <option value="">Not specified</option>
                          <option value="emt">EMT-Basic</option>
                          <option value="aemt">AEMT</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Years of EMS Experience</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="50"
                          value={editYearsEmsExperience}
                          onChange={e => setEditYearsEmsExperience(e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Primary Work Setting</label>
                        <select value={editPriorWorkSetting} onChange={e => setEditPriorWorkSetting(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700">
                          <option value="">Not specified</option>
                          <option value="911">911/Fire</option>
                          <option value="ift">Private/IFT</option>
                          <option value="hospital">Hospital</option>
                          <option value="flight">Flight/Critical Care</option>
                          <option value="volunteer">Volunteer</option>
                          <option value="none">Not currently working in EMS</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prior Employer</label>
                        <input
                          type="text"
                          value={editPriorEmployer}
                          onChange={e => setEditPriorEmployer(e.target.value)}
                          placeholder="Optional"
                          className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                        />
                      </div>
                    </div>
                  </div>

                  {/* School Student ID */}
                  <div className="pt-4 border-t dark:border-gray-600">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">School Student ID</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student ID Number</label>
                      <input
                        type="text"
                        value={editStudentId}
                        onChange={e => setEditStudentId(e.target.value)}
                        placeholder="Enter school-assigned ID"
                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Used for library barcode generation</p>
                    </div>
                  </div>

                  {/* Scrub Sizes */}
                  <div className="pt-4 border-t dark:border-gray-600">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Scrub Sizes</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Top Size</label>
                        <select value={editScrubTopSize} onChange={e => setEditScrubTopSize(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700">
                          <option value="">Not specified</option>
                          <option value="XS">XS</option>
                          <option value="S">S</option>
                          <option value="M">M</option>
                          <option value="L">L</option>
                          <option value="XL">XL</option>
                          <option value="2XL">2XL</option>
                          <option value="3XL">3XL</option>
                          <option value="4XL">4XL</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bottom Size</label>
                        <select value={editScrubBottomSize} onChange={e => setEditScrubBottomSize(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700">
                          <option value="">Not specified</option>
                          <option value="XS">XS</option>
                          <option value="S">S</option>
                          <option value="M">M</option>
                          <option value="L">L</option>
                          <option value="XL">XL</option>
                          <option value="2XL">2XL</option>
                          <option value="3XL">3XL</option>
                          <option value="4XL">4XL</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className="px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{student.first_name} {student.last_name}</h1>
                        {highestFlagLevel === 'red' && (
                          <span
                            title="Red flag — see Notes tab"
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium rounded-full"
                          >
                            <Flag className="w-3 h-3" />
                            Red Flag
                          </span>
                        )}
                        {highestFlagLevel === 'yellow' && (
                          <span
                            title="Yellow flag — see Notes tab"
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium rounded-full"
                          >
                            <Flag className="w-3 h-3" />
                            Yellow Flag
                          </span>
                        )}
                      </div>
                      {student.cohort && (
                        <p className="text-gray-600 dark:text-gray-400">{student.cohort.program.abbreviation} Group {student.cohort.cohort_number}</p>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <Link
                        href={`/students/${studentId}/progress`}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg font-medium"
                      >
                        <TrendingUp className="w-4 h-4" />
                        View Progress
                      </Link>
                      <button onClick={() => setEditing(true)} className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                        <Edit2 className="w-5 h-5" />
                      </button>
                      {userRole && canManageStudentRoster(userRole) && (
                        <button onClick={handleDelete} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[student.status]}`}>
                        {student.status.charAt(0).toUpperCase() + student.status.slice(1).replace('_', ' ')}
                      </span>
                    </div>
                    {student.email && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${student.email}`} className="hover:text-blue-600 dark:hover:text-blue-400">{student.email}</a>
                      </div>
                    )}
                    {student.agency && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Building className="w-4 h-4" />
                        <span>{student.agency}</span>
                      </div>
                    )}
                  </div>

                  {student.notes && (
                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                      <strong>Notes:</strong> {student.notes}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 mb-1">
              <Star className="w-5 h-5" />
              <span className="text-sm font-medium">Team Lead</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{student.team_lead_count}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">assignments</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
              <Calendar className="w-5 h-5" />
              <span className="text-sm font-medium">Last TL</span>
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {student.last_team_lead_date
                ? new Date(student.last_team_lead_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '—'}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
              <ClipboardCheck className="w-5 h-5" />
              <span className="text-sm font-medium">Assessments</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{assessments.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">recorded</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
              <User className="w-5 h-5" />
              <span className="text-sm font-medium">Joined</span>
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {new Date(student.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="flex border-b dark:border-gray-700">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'notes'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Notes
              {studentNotes.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                  {studentNotes.length}
                </span>
              )}
              {highestFlagLevel === 'red' && (
                <span className="w-2 h-2 rounded-full bg-red-500 ml-0.5" />
              )}
              {highestFlagLevel === 'yellow' && (
                <span className="w-2 h-2 rounded-full bg-yellow-400 ml-0.5" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('compliance')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'compliance'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              Compliance
              {complianceItems.length > 0 && (() => {
                const missing = complianceItems.filter(i => i.effective_status === 'missing' || i.effective_status === 'expired').length;
                const expiring = complianceItems.filter(i => i.effective_status === 'expiring').length;
                if (missing > 0) return <span className="w-2 h-2 rounded-full bg-red-500 ml-0.5" />;
                if (expiring > 0) return <span className="w-2 h-2 rounded-full bg-yellow-400 ml-0.5" />;
                return null;
              })()}
            </button>
          </div>

          {/* Overview Tab Content */}
          {activeTab === 'overview' && (
            <div className="p-0">
              {/* placeholder - overview content is rendered below outside this card */}
            </div>
          )}

          {/* Compliance Tab Content */}
          {activeTab === 'compliance' && (
            <div className="p-5 space-y-4">
              {complianceLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                </div>
              ) : complianceItems.length === 0 ? (
                <div className="text-center py-10">
                  <Shield className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No compliance document types configured.</p>
                </div>
              ) : (
                <>
                  {/* Overall progress bar */}
                  {(() => {
                    const complete = complianceItems.filter(i => i.effective_status === 'complete').length;
                    const total = complianceItems.length;
                    const pct = total > 0 ? Math.round((complete / total) * 100) : 0;
                    return (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            Overall Compliance
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {complete}/{total} documents — {pct}%
                          </span>
                        </div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all rounded-full ${
                              pct === 100 ? 'bg-green-500' : pct >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Document list */}
                  <div className="divide-y dark:divide-gray-700 border dark:border-gray-700 rounded-lg overflow-hidden">
                    {complianceItems.map((item) => {
                      const isEditing = complianceEditId === item.doc_type.id;
                      const isSaving = complianceSaving === item.doc_type.id;
                      const isVerifying = complianceVerifying === item.record?.id;
                      const status = item.effective_status;

                      return (
                        <div
                          key={item.doc_type.id}
                          className={`p-4 ${
                            status === 'complete'
                              ? 'bg-white dark:bg-gray-800'
                              : status === 'expiring'
                              ? 'bg-amber-50 dark:bg-amber-900/10'
                              : 'bg-red-50 dark:bg-red-900/10'
                          }`}
                        >
                          {isEditing ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 mb-1">
                                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                <span className="font-medium text-gray-900 dark:text-white">{item.doc_type.name}</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
                                  <select
                                    value={complianceEditStatus}
                                    onChange={e => setComplianceEditStatus(e.target.value as 'complete' | 'missing' | 'expiring' | 'expired')}
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                                  >
                                    <option value="complete">Complete</option>
                                    <option value="missing">Missing</option>
                                    <option value="expiring">Expiring Soon</option>
                                    <option value="expired">Expired</option>
                                  </select>
                                </div>
                                {item.doc_type.expiration_months && (
                                  <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Expiration Date</label>
                                    <input
                                      type="date"
                                      value={complianceEditExpDate}
                                      onChange={e => setComplianceEditExpDate(e.target.value)}
                                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                                    />
                                  </div>
                                )}
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Notes</label>
                                <input
                                  type="text"
                                  value={complianceEditNotes}
                                  onChange={e => setComplianceEditNotes(e.target.value)}
                                  placeholder="Optional notes..."
                                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setComplianceEditId(null)}
                                  className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveCompliance(item.doc_type.id)}
                                  disabled={isSaving}
                                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                                >
                                  {isSaving ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                {/* Status icon */}
                                <div className="mt-0.5 shrink-0">
                                  {status === 'complete' ? (
                                    <CheckCircle className="w-5 h-5 text-green-500 dark:text-green-400" />
                                  ) : status === 'expiring' ? (
                                    <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                                  ) : (
                                    <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                                      {item.doc_type.name}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      status === 'complete'
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : status === 'expiring'
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                      {status === 'complete' ? 'Complete' : status === 'expiring' ? 'Expiring Soon' : status === 'expired' ? 'Expired' : 'Missing'}
                                    </span>
                                  </div>
                                  {item.doc_type.description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.doc_type.description}</p>
                                  )}
                                  {item.record?.expiration_date && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                      Expires: {new Date(item.record.expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                  )}
                                  {item.record?.notes && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{item.record.notes}</p>
                                  )}
                                  {item.record?.verified_by && (
                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                      Verified by {item.record.verified_by}
                                      {item.record.verified_at && ` on ${new Date(item.record.verified_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {/* Action buttons */}
                              <div className="flex gap-1.5 shrink-0">
                                {item.record && !item.record.verified_by && userRole && hasMinRole(userRole, 'admin') && (
                                  <button
                                    onClick={() => handleVerifyCompliance(item.record!.id)}
                                    disabled={isVerifying}
                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg border border-green-200 dark:border-green-800"
                                    title="Mark as verified"
                                  >
                                    <Check className="w-3 h-3" />
                                    {isVerifying ? '...' : 'Verify'}
                                  </button>
                                )}
                                <button
                                  onClick={() => openComplianceEdit(item)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg border border-blue-200 dark:border-blue-800"
                                  title={item.record ? 'Update document' : 'Add document'}
                                >
                                  <Upload className="w-3 h-3" />
                                  {item.record ? 'Update' : 'Add'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Notes Tab Content */}
          {activeTab === 'notes' && (
            <div className="p-5 space-y-5">
              {/* Instructor-only notice */}
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                <Flag className="w-3.5 h-3.5 shrink-0" />
                These notes are private and visible to instructors only. Students cannot see this information.
              </div>

              {/* Add Note Form */}
              <div className="border dark:border-gray-700 rounded-lg p-4 space-y-3">
                <h3 className="font-medium text-gray-900 dark:text-white text-sm">Add Note</h3>
                <textarea
                  value={newNoteContent}
                  onChange={e => setNewNoteContent(e.target.value)}
                  rows={3}
                  placeholder="Write an observation, concern, or note about this student..."
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 resize-none"
                />
                <div className="flex flex-wrap gap-3 items-end">
                  {/* Category */}
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Category</label>
                    <select
                      value={newNoteCategory}
                      onChange={e => setNewNoteCategory(e.target.value as 'academic' | 'behavioral' | 'medical' | 'other')}
                      className="px-2 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    >
                      <option value="academic">Academic</option>
                      <option value="behavioral">Behavioral</option>
                      <option value="medical">Medical</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  {/* Flag Level */}
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Flag</label>
                    <select
                      value={newNoteFlagLevel ?? ''}
                      onChange={e => setNewNoteFlagLevel(e.target.value === '' ? null : e.target.value as 'yellow' | 'red')}
                      className="px-2 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    >
                      <option value="">No Flag</option>
                      <option value="yellow">Yellow Flag</option>
                      <option value="red">Red Flag</option>
                    </select>
                  </div>
                  <button
                    onClick={handleAddNote}
                    disabled={savingNote || !newNoteContent.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    {savingNote ? 'Saving...' : 'Add Note'}
                  </button>
                </div>
              </div>

              {/* Notes List */}
              {notesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                </div>
              ) : studentNotes.length === 0 ? (
                <div className="text-center py-10">
                  <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No notes yet. Add the first one above.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {studentNotes.map(note => {
                    const catBadge = CATEGORY_BADGES[note.category] || CATEGORY_BADGES.other;
                    const isEditing = editingNoteId === note.id;
                    const canEdit = note.author_id === currentUserId || (userRole && hasMinRole(userRole, 'lead_instructor'));

                    return (
                      <div
                        key={note.id}
                        className={`border rounded-lg p-4 ${
                          note.flag_level === 'red'
                            ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                            : note.flag_level === 'yellow'
                            ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        {isEditing ? (
                          <div className="space-y-3">
                            <textarea
                              value={editNoteContent}
                              onChange={e => setEditNoteContent(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 resize-none"
                            />
                            <div className="flex flex-wrap gap-3 items-center">
                              <select
                                value={editNoteCategory}
                                onChange={e => setEditNoteCategory(e.target.value as 'academic' | 'behavioral' | 'medical' | 'other')}
                                className="px-2 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                              >
                                <option value="academic">Academic</option>
                                <option value="behavioral">Behavioral</option>
                                <option value="medical">Medical</option>
                                <option value="other">Other</option>
                              </select>
                              <select
                                value={editNoteFlagLevel ?? ''}
                                onChange={e => setEditNoteFlagLevel(e.target.value === '' ? null : e.target.value as 'yellow' | 'red')}
                                className="px-2 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                              >
                                <option value="">No Flag</option>
                                <option value="yellow">Yellow Flag</option>
                                <option value="red">Red Flag</option>
                              </select>
                              <div className="flex gap-2 ml-auto">
                                <button
                                  onClick={() => setEditingNoteId(null)}
                                  className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleSaveEditNote}
                                  disabled={savingEditNote || !editNoteContent.trim()}
                                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                                >
                                  {savingEditNote ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${catBadge.bg} ${catBadge.text}`}>
                                  {catBadge.label}
                                </span>
                                {note.flag_level === 'red' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                    <Flag className="w-3 h-3" /> Red Flag
                                  </span>
                                )}
                                {note.flag_level === 'yellow' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                                    <Flag className="w-3 h-3" /> Yellow Flag
                                  </span>
                                )}
                              </div>
                              {canEdit && (
                                <div className="flex gap-1 shrink-0">
                                  <button
                                    onClick={() => handleStartEditNote(note)}
                                    className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                                    title="Edit note"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteNote(note.id)}
                                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                                    title="Delete note"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{note.content}</p>
                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <span>{note.author?.name || note.author_email || 'Unknown'}</span>
                              <span>·</span>
                              <span title={new Date(note.created_at).toLocaleString()}>
                                {formatRelativeTime(note.created_at)}
                              </span>
                              {note.updated_at !== note.created_at && (
                                <>
                                  <span>·</span>
                                  <span className="italic">edited</span>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Overview Tab Sections */}
        {activeTab === 'overview' && <>

        {/* EMS Background Section */}
        {(student.prior_cert_level || student.years_ems_experience || student.prior_work_setting || student.prior_employer) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              EMS Background
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {student.prior_cert_level && (
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Prior Certification</div>
                  <div className="text-gray-900 dark:text-white font-medium">
                    {student.prior_cert_level === 'emt' && 'EMT-Basic'}
                    {student.prior_cert_level === 'aemt' && 'AEMT'}
                    {student.prior_cert_level === 'other' && 'Other'}
                  </div>
                </div>
              )}
              {student.years_ems_experience !== null && (
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">EMS Experience</div>
                  <div className="text-gray-900 dark:text-white font-medium">
                    {student.years_ems_experience} {student.years_ems_experience === 1 ? 'year' : 'years'}
                  </div>
                </div>
              )}
              {student.prior_work_setting && (
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Work Setting</div>
                  <div className="text-gray-900 dark:text-white font-medium">
                    {student.prior_work_setting === '911' && '911/Fire'}
                    {student.prior_work_setting === 'ift' && 'Private/IFT'}
                    {student.prior_work_setting === 'hospital' && 'Hospital'}
                    {student.prior_work_setting === 'flight' && 'Flight/Critical Care'}
                    {student.prior_work_setting === 'volunteer' && 'Volunteer'}
                    {student.prior_work_setting === 'none' && 'Not currently working in EMS'}
                  </div>
                </div>
              )}
              {student.prior_employer && (
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Prior Employer</div>
                  <div className="text-gray-900 dark:text-white font-medium">{student.prior_employer}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scrub Sizes Section */}
        {(student.scrub_top_size || student.scrub_bottom_size) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <span className="text-lg">👕</span>
              Scrub Sizes
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Top Size</div>
                <div className="text-gray-900 dark:text-white font-medium">
                  {student.scrub_top_size || '—'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Bottom Size</div>
                <div className="text-gray-900 dark:text-white font-medium">
                  {student.scrub_bottom_size || '—'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Library Barcode Section */}
        {student.student_id && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <BarcodeIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Library Barcode
            </h2>
            <div className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-lg border dark:border-gray-600">
                <Barcode
                  value={`STU-${student.student_id}`}
                  format="CODE128"
                  width={2}
                  height={50}
                  displayValue={true}
                  fontSize={14}
                  background="#ffffff"
                  lineColor="#000000"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                School ID: {student.student_id}
              </p>
            </div>
          </div>
        )}

        {/* Learning Styles Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Learning Styles
            </h2>
            {!editingLearningStyle && userRole && canManageStudentRoster(userRole) && (
              <button
                onClick={() => setEditingLearningStyle(true)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                {learningStyle ? 'Edit' : 'Add Assessment'}
              </button>
            )}
          </div>

          <div className="p-4">
            {editingLearningStyle ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Primary Learning Style *
                    </label>
                    <select
                      value={lsPrimaryStyle}
                      onChange={(e) => setLsPrimaryStyle(e.target.value)}
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select...</option>
                      <option value="audio">Audio</option>
                      <option value="visual">Visual</option>
                      <option value="kinesthetic">Kinesthetic</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Social Learning Style *
                    </label>
                    <select
                      value={lsSocialStyle}
                      onChange={(e) => setLsSocialStyle(e.target.value)}
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select...</option>
                      <option value="social">Social</option>
                      <option value="independent">Independent</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={lsNotes}
                    onChange={(e) => setLsNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Additional observations..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingLearningStyle(false);
                      if (learningStyle) {
                        setLsPrimaryStyle(learningStyle.primary_style || '');
                        setLsSocialStyle(learningStyle.social_style || '');
                        setLsNotes(learningStyle.notes || '');
                      }
                    }}
                    className="px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveLearningStyle}
                    disabled={savingLearningStyle}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                  >
                    {savingLearningStyle ? 'Saving...' : 'Save Assessment'}
                  </button>
                </div>
              </div>
            ) : learningStyle ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <span className={`px-3 py-1 rounded-lg text-sm font-medium ${STYLE_BADGES[learningStyle.primary_style]?.bg} ${STYLE_BADGES[learningStyle.primary_style]?.text}`}>
                    Primary: {STYLE_BADGES[learningStyle.primary_style]?.label || learningStyle.primary_style}
                  </span>
                  <span className={`px-3 py-1 rounded-lg text-sm font-medium ${STYLE_BADGES[learningStyle.social_style]?.bg} ${STYLE_BADGES[learningStyle.social_style]?.text}`}>
                    Social: {STYLE_BADGES[learningStyle.social_style]?.label || learningStyle.social_style}
                  </span>
                </div>
                {learningStyle.notes && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                    <strong>Notes:</strong> {learningStyle.notes}
                  </div>
                )}
                {learningStyle.assessed_date && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Assessed: {new Date(learningStyle.assessed_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <Brain className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">No learning style assessment yet</p>
                {userRole && canManageStudentRoster(userRole) && (
                  <button
                    onClick={() => setEditingLearningStyle(true)}
                    className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Add Assessment
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Clinical Tasks */}
        {clinicalTasks && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">Clinical Progress</h2>
              <Link href="/clinical/overview" className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                View Dashboard <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Compliance Docs */}
              <div className="border dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-gray-900 dark:text-white">Compliance Docs</span>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">{clinicalTasks.compliance.completed.length}/{clinicalTasks.compliance.total}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{clinicalTasks.compliance.percent}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${clinicalTasks.compliance.percent === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{ width: `${clinicalTasks.compliance.percent}%` }}
                    />
                  </div>
                </div>
                {clinicalTasks.compliance.percent < 100 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Missing: {REQUIRED_DOCS.filter(d => !clinicalTasks.compliance.completed.includes(d)).slice(0, 3).map(d => d.toUpperCase()).join(', ')}
                    {REQUIRED_DOCS.filter(d => !clinicalTasks.compliance.completed.includes(d)).length > 3 && '...'}
                  </div>
                )}
                {clinicalTasks.compliance.percent === 100 && (
                  <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <Check className="w-3 h-3" /> All documents complete
                  </div>
                )}
              </div>

              {/* mCE Modules */}
              <div className="border dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium text-gray-900 dark:text-white">mCE Modules</span>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">{clinicalTasks.mce.completed.length}/{clinicalTasks.mce.total}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{clinicalTasks.mce.percent}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${clinicalTasks.mce.percent === 100 ? 'bg-green-500' : 'bg-purple-500'}`}
                      style={{ width: `${clinicalTasks.mce.percent}%` }}
                    />
                  </div>
                </div>
                {clinicalTasks.mce.percent === 100 ? (
                  <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <Check className="w-3 h-3" /> All modules complete
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {clinicalTasks.mce.total - clinicalTasks.mce.completed.length} modules remaining
                  </div>
                )}
              </div>

              {/* Clinical Hours */}
              <div className="border dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <span className="font-medium text-gray-900 dark:text-white">Clinical Hours</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {clinicalTasks.clinicalHours.total}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {clinicalTasks.clinicalHours.total >= 24 ? (
                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Minimum met (24h)
                    </span>
                  ) : (
                    <span className="text-orange-600 dark:text-orange-400">
                      {24 - clinicalTasks.clinicalHours.total}h to minimum
                    </span>
                  )}
                </div>
              </div>

              {/* Internship Status */}
              <div className="border dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="font-medium text-gray-900 dark:text-white">Internship</span>
                </div>
                {clinicalTasks.internship ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        clinicalTasks.internship.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        clinicalTasks.internship.status === 'at_risk' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                        clinicalTasks.internship.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {clinicalTasks.internship.status.charAt(0).toUpperCase() + clinicalTasks.internship.status.slice(1).replace('_', ' ')}
                      </span>
                      {clinicalTasks.internship.currentPhase && (
                        <span className="text-sm text-gray-600 dark:text-gray-400">Phase {clinicalTasks.internship.currentPhase}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {clinicalTasks.internship.agency || 'No agency assigned'}
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className={clinicalTasks.internship.phase1Completed ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}>
                        {clinicalTasks.internship.phase1Completed ? '✓' : '○'} P1
                      </span>
                      <span className={clinicalTasks.internship.phase2Completed ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}>
                        {clinicalTasks.internship.phase2Completed ? '✓' : '○'} P2
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                    <X className="w-4 h-4" />
                    <span className="text-sm">No internship assigned</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Team Lead History */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Team Lead History</h2>
          </div>
          {teamLeadHistory.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Star className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <p>No team lead assignments yet</p>
            </div>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {teamLeadHistory.map((entry) => (
                <div key={entry.id} className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                    <Star className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {entry.scenario?.title || `Station ${entry.lab_station.station_number}`}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {entry.lab_day.week_number && ` • Week ${entry.lab_day.week_number}, Day ${entry.lab_day.day_number}`}
                    </div>
                  </div>
                  {entry.scenario?.category && (
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded">
                      {entry.scenario.category}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Assessments */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Recent Assessments</h2>
          </div>
          {assessments.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <p>No assessments recorded yet</p>
            </div>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {assessments.map((assessment) => (
                <div key={assessment.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(assessment.assessed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    {assessment.skill_name && (
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs rounded">Skill</span>
                    )}
                  </div>
                  {assessment.skill_name ? (
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{assessment.skill_name}</div>
                      {assessment.overall_competency && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Overall:</span>
                          <span className="font-bold dark:text-white">{assessment.overall_competency}/5</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      {assessment.assessment_score !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Assessment:</span>
                          <span className={`w-6 h-6 rounded text-white text-sm font-bold flex items-center justify-center ${SCORE_COLORS[assessment.assessment_score]}`}>
                            {assessment.assessment_score}
                          </span>
                        </div>
                      )}
                      {assessment.treatment_score !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Treatment:</span>
                          <span className={`w-6 h-6 rounded text-white text-sm font-bold flex items-center justify-center ${SCORE_COLORS[assessment.treatment_score]}`}>
                            {assessment.treatment_score}
                          </span>
                        </div>
                      )}
                      {assessment.communication_score !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Comm:</span>
                          <span className={`w-6 h-6 rounded text-white text-sm font-bold flex items-center justify-center ${SCORE_COLORS[assessment.communication_score]}`}>
                            {assessment.communication_score}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        </>}

      </main>
    </div>
  );
}

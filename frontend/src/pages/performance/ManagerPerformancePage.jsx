import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import taskService from '../../services/taskService';
import kpiService from '../../services/kpiService';
import performanceService from '../../services/performanceService';
import employeeService from '../../services/employeeService';
import { syncTasks } from '../../services/backendSync';

import TaskTable from '../../components/performance/TaskTable';
import TaskModal from '../../components/performance/TaskModal';
import TaskDeleteModal from '../../components/performance/TaskDeleteModal';
import TaskHistoryModal from '../../components/performance/TaskHistoryModal';
import KpiListTable from '../../components/performance/KpiListTable';
import AppraisalListTable from '../../components/performance/AppraisalListTable';
import AppraisalReviewModal from '../../components/performance/AppraisalReviewModal';
import StartReviewModal from '../../components/performance/StartReviewModal';
import FeedbackAndDevelopmentHub from '../../components/performance/FeedbackAndDevelopmentHub';

export default function ManagerPerformancePage({ isTeamLead = false }) {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'tasks');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const [teamTasks, setTeamTasks] = useState([]);
  const [departmentKpis, setDepartmentKpis] = useState([]);
  const [teamReviews, setTeamReviews] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [teamFeedbacks, setTeamFeedbacks] = useState([]);
  const [teamPlans, setTeamPlans] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskToCancel, setTaskToCancel] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [isStartReviewOpen, setIsStartReviewOpen] = useState(false);

  const canManagerCancel = !isTeamLead && String(currentUser?.role || '').toLowerCase() !== 'team_lead';

  const loadData = () => {
    try {
      const effectiveRole = currentUser?.role === 'team_lead' || isTeamLead ? 'team_lead' : 'manager';
      const myId = currentUser?.employeeId || currentUser?.id || (effectiveRole === 'team_lead' ? 'EMP-005' : 'EMP-003');
      const reports = employeeService.getAuthorizedTeamEmployees(myId, effectiveRole) || [];
      const deptStaff = effectiveRole === 'team_lead' ? reports : (employeeService.getEmployees({ departmentId: currentUser?.departmentId || 'DEP-01' }) || []);
      setTeamMembers((reports || []).length > 0 ? reports : ((deptStaff || []).length > 0 ? deptStaff : [currentUser].filter(Boolean)));
    } catch (e) {
      console.error('Error loading team reports:', e);
      setTeamMembers([currentUser].filter(Boolean));
    }

    try {
      setTeamTasks(taskService.getTasks({}, currentUser) || []);
    } catch (e) {
      console.error('Error loading tasks:', e);
      setTeamTasks([]);
    }
    try {
      setDepartmentKpis(kpiService.getKpis() || []);
    } catch (e) {
      console.error('Error loading KPIs:', e);
      setDepartmentKpis([]);
    }
    try {
      setTeamReviews(performanceService.getReviews({}, currentUser) || []);
    } catch (e) {
      console.error('Error loading reviews:', e);
      setTeamReviews([]);
    }
    try {
      setCycles(performanceService.getCycles() || []);
    } catch (e) {
      console.error('Error loading cycles:', e);
      setCycles([]);
    }
    try {
      setTeamFeedbacks(performanceService.getFeedbacks({}, currentUser) || []);
    } catch (e) {
      console.error('Error loading feedbacks:', e);
      setTeamFeedbacks([]);
    }
    try {
      setTeamPlans(performanceService.getDevelopmentPlans({}, currentUser) || []);
    } catch (e) {
      console.error('Error loading plans:', e);
      setTeamPlans([]);
    }
  };

  useEffect(() => {
    let mounted = true;

    const refreshTasks = () => {
      if (mounted) {
        setTeamTasks(taskService.getTasks({}, currentUser) || []);
      }
    };

    const refreshKpis = () => {
      if (mounted) {
        setDepartmentKpis(kpiService.getKpis() || []);
      }
    };

    const refreshPerformance = () => {
      if (mounted) {
        setTeamReviews(performanceService.getReviews({}, currentUser) || []);
        setCycles(performanceService.getCycles() || []);
        setTeamFeedbacks(performanceService.getFeedbacks({}, currentUser) || []);
        setTeamPlans(performanceService.getDevelopmentPlans({}, currentUser) || []);
      }
    };

    const refreshEmployees = () => {
      if (mounted) {
        loadData();
      }
    };

    loadData();

    const unsubTasks = taskService.subscribe(refreshTasks);
    const unsubKpis = kpiService.subscribe(refreshKpis);
    const unsubPerf = performanceService.subscribe(refreshPerformance);
    const unsubEmp = employeeService.subscribe?.(refreshEmployees);

    syncTasks().then(() => {
      if (mounted) refreshTasks();
    }).catch((err) => {
      console.warn('Failed to sync tasks from database:', err);
    });

    kpiService.loadKpis().catch((err) => {
      console.warn('Failed to sync KPIs from database:', err);
    });

    performanceService.loadPerformanceDataAsync().catch((err) => {
      console.warn('Failed to sync performance reviews from database:', err);
    });

    return () => {
      mounted = false;
      unsubTasks();
      unsubKpis();
      unsubPerf();
      unsubEmp?.();
    };
  }, [currentUser]);

  const safeTasks = Array.isArray(teamTasks) ? teamTasks : [];
  const safeReviews = Array.isArray(teamReviews) ? teamReviews : [];
  const safeTeamMembers = Array.isArray(teamMembers) ? teamMembers : [];

  const tabs = [
    { id: 'tasks', label: 'Team Tasks & Deliverables', icon: 'fa-list-check', badge: safeTasks.filter(t => t?.status === 'In Progress').length },
    { id: 'reviews', label: 'Team Appraisals & Ratings', icon: 'fa-chart-simple', badge: safeReviews.filter(r => r?.status === 'Self Assessment Submitted').length },
    { id: 'kpis', label: 'Department Goals & KPIs', icon: 'fa-bullseye' },
    { id: 'plans', label: 'Mentorship & Growth Plans', icon: 'fa-route' }
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-hrms-primary tracking-tight">
            {activeTab === 'reviews'
              ? 'Team Appraisals & Ratings'
              : activeTab === 'kpis'
              ? 'Department Goals & KPIs'
              : activeTab === 'plans'
              ? 'Mentorship & Growth Plans'
              : 'Team Tasks & Deliverables'}
          </h2>
          <p className="text-xs text-hrms-muted mt-0.5">
            {activeTab === 'reviews'
              ? 'Conduct objective performance evaluations, scoring criteria, and annual review submissions.'
              : activeTab === 'kpis'
              ? 'Track progress against departmental quarterly goals and key results.'
              : activeTab === 'plans'
              ? 'Design targeted growth interventions and track mentorship milestones.'
              : 'Assign team milestones, track sprints, and supervise deliverable deadlines.'}
          </p>
        </div>
      </div>

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      <div className="bg-slate-50/50 rounded-xl min-h-[400px]">
        {activeTab === 'tasks' && (
          <TaskTable
            tasks={teamTasks}
            onUpdateProgress={async (task, p) => {
              try {
                await taskService.updateTaskProgressAsync(task.id, p, null, currentUser);
              } catch {
                taskService.updateTaskProgress(task.id, p, null, currentUser);
              }
              loadData();
            }}
            onOpenTask={(task) => {
              setSelectedTask(task);
              setIsTaskModalOpen(true);
            }}
            onAddTask={() => {
              setSelectedTask(null);
              setIsTaskModalOpen(true);
            }}
            onCancelTask={canManagerCancel ? (task) => setTaskToCancel(task) : undefined}
            onViewHistory={canManagerCancel ? () => setIsHistoryOpen(true) : undefined}
            canCreate={true}
            canDelete={false}
            canCancel={canManagerCancel}
          />
        )}

        {activeTab === 'reviews' && (
          <AppraisalListTable
            reviews={teamReviews}
            cycles={cycles}
            canInitiate={canManagerCancel}
            canManageCycles={false}
            onStartReview={() => setIsStartReviewOpen(true)}
            onOpenReview={(rev) => setSelectedReview(rev)}
          />
        )}

        {activeTab === 'kpis' && (
          <KpiListTable
            kpis={departmentKpis}
            canManage={false}
          />
        )}

        {activeTab === 'plans' && (
          <FeedbackAndDevelopmentHub
            feedbacks={teamFeedbacks}
            plans={teamPlans}
            employees={safeTeamMembers}
            currentUser={currentUser}
            canManageFeedback={true}
            canManageIdp={true}
            canInitiatePip={canManagerCancel}
            canClosePip={canManagerCancel}
            onToggleCheckpoint={async (planId, idx) => {
              try {
                await performanceService.togglePlanCheckpointAsync(planId, idx);
              } catch {
                performanceService.togglePlanCheckpoint(planId, idx);
              }
              loadData();
            }}
            onRefresh={loadData}
          />
        )}
      </div>

      {/* Modals */}
      {isTaskModalOpen && (
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
          employees={(safeTeamMembers || []).length > 0 ? safeTeamMembers : [currentUser].filter(Boolean)}
          onTaskSaved={loadData}
        />
      )}

      {taskToCancel && (
        <TaskDeleteModal
          isOpen={!!taskToCancel}
          onClose={() => setTaskToCancel(null)}
          task={taskToCancel}
          mode="cancel"
          onConfirm={async (task, reason) => {
            await taskService.cancelTaskAsync(task.id, reason, currentUser);
            await syncTasks();
            loadData();
          }}
        />
      )}

      {isHistoryOpen && (
        <TaskHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}

      {selectedReview && (
        <AppraisalReviewModal
          isOpen={!!selectedReview}
          onClose={() => setSelectedReview(null)}
          review={selectedReview}
          onReviewUpdated={(updatedRev) => {
            loadData();
            if (updatedRev?.id) setSelectedReview(updatedRev);
          }}
        />
      )}

      {isStartReviewOpen && (
        <StartReviewModal
          isOpen={isStartReviewOpen}
          onClose={() => setIsStartReviewOpen(false)}
          cycles={cycles}
          employees={safeTeamMembers}
          initialMode="review"
          canCreateCycle={false}
          onCompleted={() => loadData()}
        />
      )}
    </div>
  );
}

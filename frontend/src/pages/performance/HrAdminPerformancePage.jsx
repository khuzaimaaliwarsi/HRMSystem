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
import KpiModal from '../../components/performance/KpiModal';
import AppraisalListTable from '../../components/performance/AppraisalListTable';
import AppraisalReviewModal from '../../components/performance/AppraisalReviewModal';
import StartReviewModal from '../../components/performance/StartReviewModal';
import FeedbackAndDevelopmentHub from '../../components/performance/FeedbackAndDevelopmentHub';

export default function HrAdminPerformancePage() {
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

  const [tasks, setTasks] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [plans, setPlans] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [startReviewMode, setStartReviewMode] = useState(null);

  const loadData = () => {
    try {
      setTasks(taskService.getTasks({}, currentUser) || []);
    } catch (e) {
      console.error('Error loading tasks:', e);
      setTasks([]);
    }
    try {
      setKpis(kpiService.getKpis() || []);
    } catch (e) {
      console.error('Error loading KPIs:', e);
      setKpis([]);
    }
    try {
      setReviews(performanceService.getReviews({}, currentUser) || []);
    } catch (e) {
      console.error('Error loading reviews:', e);
      setReviews([]);
    }
    try {
      setCycles(performanceService.getCycles() || []);
    } catch (e) {
      console.error('Error loading cycles:', e);
      setCycles([]);
    }
    try {
      setFeedbacks(performanceService.getFeedbacks({}, currentUser) || []);
    } catch (e) {
      console.error('Error loading feedbacks:', e);
      setFeedbacks([]);
    }
    try {
      setPlans(performanceService.getDevelopmentPlans({}, currentUser) || []);
    } catch (e) {
      console.error('Error loading plans:', e);
      setPlans([]);
    }
    try {
      setEmployees(employeeService.getAllEmployees() || []);
    } catch (e) {
      console.error('Error loading employees:', e);
      setEmployees([]);
    }
  };

  useEffect(() => {
    let mounted = true;

    const refreshTasks = () => {
      if (mounted) {
        setTasks(taskService.getTasks({}, currentUser) || []);
      }
    };

    const refreshKpis = () => {
      if (mounted) {
        setKpis(kpiService.getKpis() || []);
      }
    };

    const refreshPerformance = () => {
      if (mounted) {
        setReviews(performanceService.getReviews({}, currentUser) || []);
        setCycles(performanceService.getCycles() || []);
        setFeedbacks(performanceService.getFeedbacks({}, currentUser) || []);
        setPlans(performanceService.getDevelopmentPlans({}, currentUser) || []);
      }
    };

    const refreshEmployees = () => {
      if (mounted) {
        setEmployees(employeeService.getAllEmployees() || []);
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

    kpiService.loadKpis().then(() => {
      if (mounted) refreshKpis();
    }).catch((err) => {
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

  const tabs = [
    { id: 'tasks', label: 'Company Tasks', icon: 'fa-list-check' },
    { id: 'kpis', label: 'Department KPIs', icon: 'fa-bullseye' },
    { id: 'reviews', label: 'Appraisals Moderation', icon: 'fa-chart-simple', badge: reviews.filter(r => r.status === 'Manager Evaluated').length },
    { id: 'plans', label: 'Development Plans & PIPs', icon: 'fa-route' }
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-hrms-primary tracking-tight">
            {activeTab === 'kpis'
              ? 'KPI & Goal Configuration'
              : activeTab === 'reviews'
              ? 'Performance Appraisals Moderation'
              : activeTab === 'plans'
              ? 'Development Plans & PIPs'
              : 'Tasks & Deliverables Tracking'}
          </h2>
          <p className="text-xs text-hrms-muted mt-0.5">
            {activeTab === 'kpis'
              ? 'Monitor department KPI achievements, target weights, and measurement criteria.'
              : activeTab === 'reviews'
              ? 'Moderate appraisal cycle submissions, verify bell-curve fairness, and prepare increment recommendations.'
              : activeTab === 'plans'
              ? 'Coordinate employee development objectives, PIP agreements, and milestone checkpoints.'
              : 'Administer company task assignments, track deliverables progress, and maintain deadlines.'}
          </p>
        </div>
      </div>

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      <div className="bg-slate-50/50 rounded-xl min-h-[400px]">
        {activeTab === 'tasks' && (
          <TaskTable
            tasks={tasks}
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
            onDeleteTask={(task) => setTaskToDelete(task)}
            onViewHistory={() => setIsHistoryOpen(true)}
            canCreate={true}
            canDelete={true}
          />
        )}

        {activeTab === 'kpis' && (
          <KpiListTable
            kpis={kpis}
            onAddKpi={() => setIsKpiModalOpen(true)}
            canManage={true}
          />
        )}

        {activeTab === 'reviews' && (
          <AppraisalListTable
            reviews={reviews}
            cycles={cycles}
            canInitiate={true}
            canManageCycles={true}
            onStartReview={() => setStartReviewMode('review')}
            onCreateCycle={() => setStartReviewMode('cycle')}
            onOpenReview={(rev) => setSelectedReview(rev)}
          />
        )}

        {activeTab === 'plans' && (
          <FeedbackAndDevelopmentHub
            feedbacks={feedbacks}
            plans={plans}
            employees={employees}
            currentUser={currentUser}
            canManageFeedback={true}
            canManageIdp={true}
            canInitiatePip={true}
            canClosePip={true}
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
          employees={employees}
          onTaskSaved={loadData}
        />
      )}

      {taskToDelete && (
        <TaskDeleteModal
          isOpen={!!taskToDelete}
          onClose={() => setTaskToDelete(null)}
          task={taskToDelete}
          mode="delete"
          onConfirm={async (task, reason) => {
            await taskService.deleteTaskAsync(task.id, reason, currentUser);
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

      {isKpiModalOpen && (
        <KpiModal
          isOpen={isKpiModalOpen}
          onClose={() => setIsKpiModalOpen(false)}
          onKpiCreated={loadData}
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

      {startReviewMode && (
        <StartReviewModal
          isOpen={!!startReviewMode}
          onClose={() => setStartReviewMode(null)}
          cycles={cycles}
          employees={employees}
          initialMode={startReviewMode}
          canCreateCycle={true}
          onCompleted={() => loadData()}
        />
      )}
    </div>
  );
}

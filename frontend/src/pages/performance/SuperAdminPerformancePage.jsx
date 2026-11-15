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

export default function SuperAdminPerformancePage() {
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

  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [startReviewMode, setStartReviewMode] = useState(null); // null | 'review' | 'cycle'

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

    const refreshKpis = () => {
      if (mounted) {
        setKpis(kpiService.getKpis() || []);
      }
    };

    const refreshTasks = () => {
      if (mounted) {
        setTasks(taskService.getTasks({}, currentUser) || []);
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

    // Listen for KPI, Task, and Performance service updates
    const unsubscribeKpi = kpiService.subscribe(refreshKpis);
    const unsubscribeTask = taskService.subscribe(refreshTasks);
    const unsubscribePerf = performanceService.subscribe(refreshPerformance);
    const unsubscribeEmp = employeeService.subscribe?.(refreshEmployees);

    // Fetch persisted KPI, Task, and Performance records from PostgreSQL backend
    kpiService.loadKpis().catch((err) => {
      console.error('Failed to load KPIs from database:', err);
    });

    performanceService.loadPerformanceDataAsync().catch((err) => {
      console.warn('Failed to load performance appraisals from database:', err);
    });

    syncTasks().then(() => {
      if (mounted) refreshTasks();
    }).catch((err) => {
      console.warn('Failed to sync tasks from database:', err);
    });

    return () => {
      mounted = false;
      unsubscribeKpi();
      unsubscribeTask();
      unsubscribePerf();
      unsubscribeEmp?.();
    };
  }, [currentUser]);

  const handleUpdateTaskProgress = async (task, newProgress) => {
    try {
      await taskService.updateTaskProgressAsync(task.id, newProgress, null, currentUser);
    } catch {
      taskService.updateTaskProgress(task.id, newProgress, null, currentUser);
    }
    loadData();
  };

  const handleToggleCheckpoint = async (planId, idx) => {
    try {
      await performanceService.togglePlanCheckpointAsync(planId, idx);
    } catch {
      performanceService.togglePlanCheckpoint(planId, idx);
    }
    loadData();
  };

  const tabs = [
    { id: 'tasks', label: 'Tasks & Deliverables', icon: 'fa-list-check', badge: tasks.filter(t => t.status === 'In Progress').length },
    { id: 'kpis', label: 'Goals & Department KPIs', icon: 'fa-bullseye' },
    { id: 'reviews', label: 'Appraisals & Reviews', icon: 'fa-chart-simple', badge: reviews.filter(r => r.status !== 'Finalized').length },
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
                ? 'Performance Appraisals & Cycles'
                : activeTab === 'plans'
                  ? 'Performance Improvement Plans (PIP)'
                  : 'Task Assignment & Tracking'}
          </h2>
          <p className="text-xs text-hrms-muted mt-0.5">
            {activeTab === 'kpis'
              ? 'Configure company objectives, departmental KPI metrics, target weightages, and scoring models.'
              : activeTab === 'reviews'
                ? 'Review and moderate annual/quarterly appraisal ratings, bell curve distributions, and increment recommendations.'
                : activeTab === 'plans'
                  ? 'Manage structured performance improvement plans (PIPs), milestones, and corrective actions.'
                  : 'Track operational deliverables, assign strategic tasks, and monitor progress across departments.'}
          </p>
        </div>
      </div>

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      <div className="bg-slate-50/50 rounded-xl min-h-[400px]">
        {activeTab === 'tasks' && (
          <TaskTable
            tasks={tasks}
            onUpdateProgress={handleUpdateTaskProgress}
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
            onToggleCheckpoint={handleToggleCheckpoint}
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

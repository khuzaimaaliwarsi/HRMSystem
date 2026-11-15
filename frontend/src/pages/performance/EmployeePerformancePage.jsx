import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import taskService from '../../services/taskService';
import kpiService from '../../services/kpiService';
import performanceService from '../../services/performanceService';
import { syncTasks } from '../../services/backendSync';

import TaskTable from '../../components/performance/TaskTable';
import TaskModal from '../../components/performance/TaskModal';
import KpiListTable from '../../components/performance/KpiListTable';
import AppraisalListTable from '../../components/performance/AppraisalListTable';
import AppraisalReviewModal from '../../components/performance/AppraisalReviewModal';
import FeedbackAndDevelopmentHub from '../../components/performance/FeedbackAndDevelopmentHub';

export default function EmployeePerformancePage() {
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

  const [myTasks, setMyTasks] = useState([]);
  const [myKpis, setMyKpis] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [myFeedbacks, setMyFeedbacks] = useState([]);
  const [myPlans, setMyPlans] = useState([]);

  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);

  const loadData = () => {
    if (!currentUser) return;
    try {
      setMyTasks(taskService.getTasks({}, currentUser) || []);
    } catch (e) {
      console.error('Error loading tasks:', e);
      setMyTasks([]);
    }
    try {
      setMyKpis(kpiService.getKpis() || []);
    } catch (e) {
      console.error('Error loading KPIs:', e);
      setMyKpis([]);
    }
    try {
      setMyReviews(performanceService.getReviews({}, currentUser) || []);
    } catch (e) {
      console.error('Error loading reviews:', e);
      setMyReviews([]);
    }
    try {
      setCycles(performanceService.getCycles() || []);
    } catch (e) {
      console.error('Error loading cycles:', e);
      setCycles([]);
    }
    try {
      setMyFeedbacks(performanceService.getFeedbacks({}, currentUser) || []);
    } catch (e) {
      console.error('Error loading feedbacks:', e);
      setMyFeedbacks([]);
    }
    try {
      setMyPlans(performanceService.getDevelopmentPlans({}, currentUser) || []);
    } catch (e) {
      console.error('Error loading plans:', e);
      setMyPlans([]);
    }
  };

  useEffect(() => {
    let mounted = true;

    const refreshTasks = () => {
      if (mounted) {
        setMyTasks(taskService.getTasks({}, currentUser) || []);
      }
    };

    const refreshKpis = () => {
      if (mounted) {
        setMyKpis(kpiService.getKpis() || []);
      }
    };

    const refreshPerformance = () => {
      if (mounted) {
        setMyReviews(performanceService.getReviews({}, currentUser) || []);
        setCycles(performanceService.getCycles() || []);
        setMyFeedbacks(performanceService.getFeedbacks({}, currentUser) || []);
        setMyPlans(performanceService.getDevelopmentPlans({}, currentUser) || []);
      }
    };

    loadData();

    const unsubTasks = taskService.subscribe(refreshTasks);
    const unsubKpis = kpiService.subscribe(refreshKpis);
    const unsubPerf = performanceService.subscribe(refreshPerformance);

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
    };
  }, [currentUser]);

  const tabs = [
    { id: 'tasks', label: 'My Assigned Tasks', icon: 'fa-list-check', badge: myTasks.filter(t => t.status === 'In Progress').length },
    { id: 'reviews', label: 'My Appraisals & Ratings', icon: 'fa-chart-simple', badge: myReviews.filter(r => r.status === 'Finalized' && !r.isAcknowledged).length },
    { id: 'kpis', label: 'Department Goals & KPIs', icon: 'fa-bullseye' },
    { id: 'plans', label: 'My Growth Plan & Checkpoints', icon: 'fa-route' }
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-hrms-primary tracking-tight">
            {activeTab === 'reviews'
              ? 'My Appraisals & Reviews'
              : activeTab === 'plans'
              ? 'My Growth Plan & Checkpoints'
              : 'My Tasks & Deliverables'}
          </h2>
          <p className="text-xs text-hrms-muted mt-0.5">
            {activeTab === 'reviews'
              ? 'Complete self-evaluations, review manager feedback, and track cycle milestones.'
              : activeTab === 'plans'
              ? 'Track individual development targets, mentorship checkpoints, and upskilling goals.'
              : 'Track committed sprint deliverables, update task progress, and review deadlines.'}
          </p>
        </div>
      </div>

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      <div className="bg-slate-50/50 rounded-xl min-h-[400px]">
        {activeTab === 'tasks' && (
          <TaskTable
            tasks={myTasks}
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
            canCreate={false}
          />
        )}

        {activeTab === 'reviews' && (
          <AppraisalListTable
            reviews={myReviews}
            cycles={cycles}
            onOpenReview={(rev) => setSelectedReview(rev)}
          />
        )}

        {activeTab === 'kpis' && (
          <KpiListTable
            kpis={myKpis}
            canManage={false}
          />
        )}

        {activeTab === 'plans' && (
          <FeedbackAndDevelopmentHub
            feedbacks={myFeedbacks}
            plans={myPlans}
            employees={[currentUser].filter(Boolean)}
            currentUser={currentUser}
            canManageFeedback={false}
            canManageIdp={false}
            canInitiatePip={false}
            canClosePip={false}
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
          employees={[currentUser]}
          onTaskSaved={loadData}
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
    </div>
  );
}

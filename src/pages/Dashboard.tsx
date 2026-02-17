import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { BookOpen, FileText, Users, BarChart } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DashboardStats {
  courses: number;
  assignments: number;
  students?: number;
  submissions?: number;
  averageGrade?: number;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    courses: 0,
    assignments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [profile]);

  async function loadDashboardData() {
    try {
      if (profile?.role === 'teacher') {
        const { data: courses } = await supabase
          .from('courses')
          .select('id')
          .eq('teacher_id', profile.id);

        const courseIds = courses?.map(c => c.id) || [];

        const { data: assignments } = await supabase
          .from('assignments')
          .select('id')
          .in('course_id', courseIds);

        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('id')
          .in('course_id', courseIds)
          .eq('status', 'active');

        const { data: submissions } = await supabase
          .from('submissions')
          .select('id')
          .in('assignment_id', assignments?.map(a => a.id) || []);

        setStats({
          courses: courses?.length || 0,
          assignments: assignments?.length || 0,
          students: enrollments?.length || 0,
          submissions: submissions?.length || 0,
        });
      } else if (profile?.role === 'student') {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('student_id', profile.id)
          .eq('status', 'active');

        const courseIds = enrollments?.map(e => e.course_id) || [];

        const { data: assignments } = await supabase
          .from('assignments')
          .select('id')
          .in('course_id', courseIds);

        const { data: submissions } = await supabase
          .from('submissions')
          .select('id, grades(points_earned)')
          .eq('student_id', profile.id);

        const { data: grades } = await supabase
          .from('grades')
          .select('points_earned, submissions!inner(assignment_id, assignments!inner(total_points))')
          .eq('submissions.student_id', profile.id);

        let averageGrade = 0;
        if (grades && grades.length > 0) {
          const totalPercentage = grades.reduce((sum: number, grade: any) => {
            const percentage = (grade.points_earned / grade.submissions.assignments.total_points) * 100;
            return sum + percentage;
          }, 0);
          averageGrade = totalPercentage / grades.length;
        }

        setStats({
          courses: courseIds.length,
          assignments: assignments?.length || 0,
          submissions: submissions?.length || 0,
          averageGrade: averageGrade,
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  const teacherStats = [
    {
      label: 'Total Courses',
      value: stats.courses,
      icon: BookOpen,
      color: 'bg-blue-500',
      link: '/courses',
    },
    {
      label: 'Assignments',
      value: stats.assignments,
      icon: FileText,
      color: 'bg-green-500',
      link: '/assignments',
    },
    {
      label: 'Students',
      value: stats.students || 0,
      icon: Users,
      color: 'bg-purple-500',
      link: '/students',
    },
    {
      label: 'Submissions',
      value: stats.submissions || 0,
      icon: BarChart,
      color: 'bg-orange-500',
      link: '/assignments',
    },
  ];

  const studentStats = [
    {
      label: 'Enrolled Courses',
      value: stats.courses,
      icon: BookOpen,
      color: 'bg-blue-500',
      link: '/courses',
    },
    {
      label: 'Total Assignments',
      value: stats.assignments,
      icon: FileText,
      color: 'bg-green-500',
      link: '/assignments',
    },
    {
      label: 'Submitted',
      value: stats.submissions || 0,
      icon: BarChart,
      color: 'bg-purple-500',
      link: '/assignments',
    },
    {
      label: 'Average Grade',
      value: stats.averageGrade ? `${stats.averageGrade.toFixed(1)}%` : 'N/A',
      icon: BarChart,
      color: 'bg-orange-500',
      link: '/grades',
    },
  ];

  const displayStats = profile?.role === 'teacher' ? teacherStats : studentStats;

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {profile?.full_name}!
          </h1>
          <p className="text-gray-600 mt-1">
            {profile?.role === 'teacher'
              ? 'Here is an overview of your teaching activities'
              : 'Here is an overview of your learning progress'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Link
                key={index}
                to={stat.link}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {profile?.role === 'teacher' ? (
              <>
                <Link
                  to="/courses"
                  className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <BookOpen className="w-8 h-8 text-primary-600 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">Create Course</p>
                    <p className="text-sm text-gray-600">Start a new course</p>
                  </div>
                </Link>
                <Link
                  to="/assignments"
                  className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FileText className="w-8 h-8 text-primary-600 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">Create Assignment</p>
                    <p className="text-sm text-gray-600">Add new assignment</p>
                  </div>
                </Link>
                <Link
                  to="/students"
                  className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Users className="w-8 h-8 text-primary-600 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">View Students</p>
                    <p className="text-sm text-gray-600">Manage enrollments</p>
                  </div>
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/courses"
                  className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <BookOpen className="w-8 h-8 text-primary-600 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">View Courses</p>
                    <p className="text-sm text-gray-600">Browse your courses</p>
                  </div>
                </Link>
                <Link
                  to="/assignments"
                  className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FileText className="w-8 h-8 text-primary-600 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">Assignments</p>
                    <p className="text-sm text-gray-600">View and submit</p>
                  </div>
                </Link>
                <Link
                  to="/grades"
                  className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <BarChart className="w-8 h-8 text-primary-600 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">View Grades</p>
                    <p className="text-sm text-gray-600">Check your progress</p>
                  </div>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

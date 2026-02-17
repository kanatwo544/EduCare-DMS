import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { BarChart, FileText } from 'lucide-react';

interface GradeData {
  assignment_title: string;
  course_title: string;
  points_earned: number;
  total_points: number;
  feedback: string | null;
  graded_at: string;
}

export default function Grades() {
  const { profile } = useAuth();
  const [grades, setGrades] = useState<GradeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGrades();
  }, [profile]);

  async function loadGrades() {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          assignment_id,
          assignments (
            title,
            total_points,
            courses (
              title
            )
          ),
          grades (
            points_earned,
            feedback,
            graded_at
          )
        `)
        .eq('student_id', profile?.id)
        .not('grades', 'is', null);

      if (error) throw error;

      const formattedGrades: GradeData[] = data?.map((item: any) => ({
        assignment_title: item.assignments.title,
        course_title: item.assignments.courses.title,
        points_earned: item.grades[0]?.points_earned || 0,
        total_points: item.assignments.total_points,
        feedback: item.grades[0]?.feedback,
        graded_at: item.grades[0]?.graded_at,
      })) || [];

      setGrades(formattedGrades);
    } catch (error) {
      console.error('Error loading grades:', error);
    } finally {
      setLoading(false);
    }
  }

  function calculatePercentage(earned: number, total: number) {
    return ((earned / total) * 100).toFixed(1);
  }

  function getGradeColor(percentage: number) {
    if (percentage >= 90) return 'text-green-600 bg-green-50';
    if (percentage >= 80) return 'text-blue-600 bg-blue-50';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-50';
    if (percentage >= 60) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
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

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Grades</h1>
          <p className="text-gray-600 mt-1">View your assignment grades and feedback</p>
        </div>

        {grades.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
            <BarChart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No grades yet</h3>
            <p className="text-gray-600">Your graded assignments will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {grades.map((grade, index) => {
              const percentage = parseFloat(calculatePercentage(grade.points_earned, grade.total_points));
              const colorClass = getGradeColor(percentage);

              return (
                <div
                  key={index}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {grade.assignment_title}
                      </h3>
                      <p className="text-sm text-gray-600">{grade.course_title}</p>
                    </div>
                    <div className={`px-4 py-2 rounded-lg ${colorClass} font-bold text-lg`}>
                      {percentage}%
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 mb-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-1" />
                      {grade.points_earned} / {grade.total_points} points
                    </div>
                    <div>
                      Graded: {new Date(grade.graded_at).toLocaleDateString()}
                    </div>
                  </div>

                  {grade.feedback && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 mb-1">Feedback:</p>
                      <p className="text-gray-700">{grade.feedback}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

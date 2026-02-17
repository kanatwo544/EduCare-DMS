import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Assignment, Course, Submission } from '../lib/supabase';
import Layout from '../components/Layout';
import { Plus, FileText, Calendar } from 'lucide-react';

interface AssignmentWithCourse extends Assignment {
  courses?: Course;
  submissions?: Submission[];
}

export default function Assignments() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentWithCourse[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissionContent, setSubmissionContent] = useState('');
  const [newAssignment, setNewAssignment] = useState({
    course_id: '',
    title: '',
    description: '',
    due_date: '',
    total_points: 100,
  });

  useEffect(() => {
    loadData();
  }, [profile]);

  async function loadData() {
    try {
      if (profile?.role === 'teacher') {
        const { data: coursesData } = await supabase
          .from('courses')
          .select('*')
          .eq('teacher_id', profile.id);

        setCourses(coursesData || []);

        const { data, error } = await supabase
          .from('assignments')
          .select('*, courses(*), submissions(*)')
          .in('course_id', coursesData?.map(c => c.id) || [])
          .order('due_date', { ascending: true });

        if (error) throw error;
        setAssignments(data || []);
      } else if (profile?.role === 'student') {
        const { data: enrollmentsData } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('student_id', profile.id)
          .eq('status', 'active');

        const courseIds = enrollmentsData?.map(e => e.course_id) || [];

        const { data, error } = await supabase
          .from('assignments')
          .select('*, courses(*), submissions(*)')
          .in('course_id', courseIds)
          .order('due_date', { ascending: true });

        if (error) throw error;
        setAssignments(data || []);
      }
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createAssignment() {
    try {
      const { error } = await supabase
        .from('assignments')
        .insert([newAssignment]);

      if (error) throw error;

      setShowCreateModal(false);
      setNewAssignment({
        course_id: '',
        title: '',
        description: '',
        due_date: '',
        total_points: 100,
      });
      loadData();
    } catch (error) {
      console.error('Error creating assignment:', error);
      alert('Failed to create assignment');
    }
  }

  async function submitAssignment() {
    if (!selectedAssignment || !profile) return;

    try {
      const { error } = await supabase
        .from('submissions')
        .insert([
          {
            assignment_id: selectedAssignment.id,
            student_id: profile.id,
            content: submissionContent,
          },
        ]);

      if (error) throw error;

      setShowSubmitModal(false);
      setSelectedAssignment(null);
      setSubmissionContent('');
      loadData();
    } catch (error) {
      console.error('Error submitting assignment:', error);
      alert('Failed to submit assignment');
    }
  }

  function hasSubmitted(assignment: AssignmentWithCourse) {
    return assignment.submissions?.some(s => s.student_id === profile?.id);
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function isOverdue(dateString: string) {
    return new Date(dateString) < new Date();
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Assignments</h1>
            <p className="text-gray-600 mt-1">
              {profile?.role === 'teacher'
                ? 'Manage course assignments'
                : 'View and submit your assignments'}
            </p>
          </div>
          {profile?.role === 'teacher' && courses.length > 0 && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Assignment
            </button>
          )}
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments yet</h3>
            <p className="text-gray-600">
              {profile?.role === 'teacher'
                ? 'Create your first assignment'
                : 'No assignments available at this time'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment) => {
              const submitted = hasSubmitted(assignment);
              const overdue = isOverdue(assignment.due_date);

              return (
                <div
                  key={assignment.id}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {assignment.title}
                        </h3>
                        {profile?.role === 'student' && (
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              submitted
                                ? 'bg-green-100 text-green-800'
                                : overdue
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {submitted ? 'Submitted' : overdue ? 'Overdue' : 'Pending'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{assignment.courses?.title}</p>
                      <p className="text-gray-700 mb-4">{assignment.description}</p>
                      <div className="flex items-center space-x-6 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          Due: {formatDate(assignment.due_date)}
                        </div>
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 mr-1" />
                          {assignment.total_points} points
                        </div>
                        {profile?.role === 'teacher' && (
                          <div className="flex items-center">
                            Submissions: {assignment.submissions?.length || 0}
                          </div>
                        )}
                      </div>
                    </div>
                    {profile?.role === 'student' && !submitted && (
                      <button
                        onClick={() => {
                          setSelectedAssignment(assignment);
                          setShowSubmitModal(true);
                        }}
                        className="ml-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        Submit
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Assignment</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Course
                  </label>
                  <select
                    value={newAssignment.course_id}
                    onChange={(e) => setNewAssignment({ ...newAssignment, course_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Select a course</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newAssignment.title}
                    onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Assignment title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newAssignment.description}
                    onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Assignment description..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="datetime-local"
                    value={newAssignment.due_date}
                    onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Points
                  </label>
                  <input
                    type="number"
                    value={newAssignment.total_points}
                    onChange={(e) => setNewAssignment({ ...newAssignment, total_points: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createAssignment}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {showSubmitModal && selectedAssignment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Submit Assignment</h2>
              <p className="text-gray-700 mb-4">{selectedAssignment.title}</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Submission
                  </label>
                  <textarea
                    value={submissionContent}
                    onChange={(e) => setSubmissionContent(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter your assignment submission here..."
                  />
                </div>
              </div>
              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => {
                    setShowSubmitModal(false);
                    setSelectedAssignment(null);
                    setSubmissionContent('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitAssignment}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

/*
  # EduCare LMS Database Schema

  ## Overview
  Complete schema for a Learning Management System with role-based access control.

  ## New Tables

  ### 1. profiles
  User profile extension with role management
  - `id` (uuid, pk, fk to auth.users)
  - `email` (text, unique)
  - `full_name` (text)
  - `role` (text) - 'teacher', 'student', or 'parent'
  - `avatar_url` (text, optional)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. courses
  Course catalog managed by teachers
  - `id` (uuid, pk)
  - `title` (text)
  - `description` (text)
  - `teacher_id` (uuid, fk to profiles)
  - `course_code` (text, unique)
  - `semester` (text)
  - `year` (integer)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. enrollments
  Student course enrollment tracking
  - `id` (uuid, pk)
  - `student_id` (uuid, fk to profiles)
  - `course_id` (uuid, fk to courses)
  - `enrolled_at` (timestamptz)
  - `status` (text) - 'active', 'completed', 'dropped'

  ### 4. assignments
  Course assignments and tasks
  - `id` (uuid, pk)
  - `course_id` (uuid, fk to courses)
  - `title` (text)
  - `description` (text)
  - `due_date` (timestamptz)
  - `total_points` (integer)
  - `created_at` (timestamptz)

  ### 5. submissions
  Student assignment submissions
  - `id` (uuid, pk)
  - `assignment_id` (uuid, fk to assignments)
  - `student_id` (uuid, fk to profiles)
  - `content` (text)
  - `submitted_at` (timestamptz)
  - `status` (text) - 'submitted', 'graded', 'late'

  ### 6. grades
  Grading system for submissions
  - `id` (uuid, pk)
  - `submission_id` (uuid, fk to submissions)
  - `points_earned` (integer)
  - `feedback` (text)
  - `graded_by` (uuid, fk to profiles)
  - `graded_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Teachers can manage their courses and grade assignments
  - Students can view their enrollments and submit assignments
  - Parents can view their children's data (future enhancement)
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('teacher', 'student', 'parent')),
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_code text UNIQUE NOT NULL,
  semester text NOT NULL,
  year integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Create enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  UNIQUE(student_id, course_id)
);

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Create assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  due_date timestamptz NOT NULL,
  total_points integer NOT NULL DEFAULT 100,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Create submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  status text DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'late')),
  UNIQUE(assignment_id, student_id)
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Create grades table
CREATE TABLE IF NOT EXISTS grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid UNIQUE NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  points_earned integer NOT NULL,
  feedback text,
  graded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  graded_at timestamptz DEFAULT now()
);

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for courses
CREATE POLICY "Anyone can view courses"
  ON courses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Teachers can create courses"
  ON courses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'teacher'
    )
  );

CREATE POLICY "Teachers can update own courses"
  ON courses FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own courses"
  ON courses FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

-- RLS Policies for enrollments
CREATE POLICY "Students can view own enrollments"
  ON enrollments FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = enrollments.course_id
      AND courses.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can enroll students"
  ON enrollments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_id
      AND courses.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can enroll in courses"
  ON enrollments FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'student'
    )
  );

-- RLS Policies for assignments
CREATE POLICY "Enrolled users can view assignments"
  ON assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = assignments.course_id
      AND (
        courses.teacher_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM enrollments
          WHERE enrollments.course_id = courses.id
          AND enrollments.student_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Teachers can create assignments"
  ON assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_id
      AND courses.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update own assignments"
  ON assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_id
      AND courses.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = course_id
      AND courses.teacher_id = auth.uid()
    )
  );

-- RLS Policies for submissions
CREATE POLICY "Students can view own submissions"
  ON submissions FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM assignments
      JOIN courses ON courses.id = assignments.course_id
      WHERE assignments.id = submissions.assignment_id
      AND courses.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can create submissions"
  ON submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM enrollments
      JOIN assignments ON assignments.course_id = enrollments.course_id
      WHERE enrollments.student_id = auth.uid()
      AND assignments.id = assignment_id
    )
  );

-- RLS Policies for grades
CREATE POLICY "Students and teachers can view grades"
  ON grades FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions
      WHERE submissions.id = grades.submission_id
      AND (
        submissions.student_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM assignments
          JOIN courses ON courses.id = assignments.course_id
          WHERE assignments.id = submissions.assignment_id
          AND courses.teacher_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Teachers can create grades"
  ON grades FOR INSERT
  TO authenticated
  WITH CHECK (
    graded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM submissions
      JOIN assignments ON assignments.id = submissions.assignment_id
      JOIN courses ON courses.id = assignments.course_id
      WHERE submissions.id = submission_id
      AND courses.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update grades"
  ON grades FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions
      JOIN assignments ON assignments.id = submissions.assignment_id
      JOIN courses ON courses.id = assignments.course_id
      WHERE submissions.id = submission_id
      AND courses.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM submissions
      JOIN assignments ON assignments.id = submissions.assignment_id
      JOIN courses ON courses.id = assignments.course_id
      WHERE submissions.id = submission_id
      AND courses.teacher_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_submission ON grades(submission_id);

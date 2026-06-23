import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";

import Auth from "./Screens/Authentication/Auth";
import EmailSent from "./Screens/Authentication/EmailSent";
import EmailVerified from "./Screens/Authentication/EmailVerified";
import Profile from "./Screens/Authentication/Profile";
import ResetPassword from "./Screens/Authentication/ResetPassword";

import LandingPage from "./Screens/LandingPage/LandingPage";
import StudentPageOne from "./Screens/StudentPageOne/StudentPageOne";
import MentorProfileCompletion from "./components/MentorCard/MentorProfileCompletion";
import MentorDashboard from "./components/MentorCard/MentorDashBoard";
import MentorProfile from "./Screens/MentorProfile/MentorProfile";
import StudentDashboard from "./Screens/StudentDashboard/StudentDashboard";
import QuestionDetail from "./Screens/QuestionDetail/QuestionDetail";
import ChatWidget from "./components/Chat/ChatWidget";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<Auth onClose={() => {}} />} />
        <Route path="/student" element={<StudentPageOne />} />
        <Route path="/email-sent" element={<EmailSent />} />
        <Route path="/email-verified" element={<EmailVerified />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/userDashboard" element={<StudentPageOne />} />
        <Route path="/student-dashboard" element={<StudentDashboard />} />
        <Route path="/mentor-profile" element={<MentorProfileCompletion />} />
        <Route path="/mentor-dashboard" element={<MentorDashboard />} />
        <Route path="/mentor/:id" element={<MentorProfile />} />
        <Route path="/question/:id" element={<QuestionDetail />} />
      </Routes>
      <ChatWidget />
    </BrowserRouter>
  );
};

export default App;

// https://chatgpt.com/c/69ec7753-60f8-83e8-bcb0-1a579d911395

import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link to="/" className="inline-flex items-center text-blue-400 hover:text-blue-300">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
        
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="space-y-6 text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-white mb-2">1. Introduction</h2>
            <p>Welcome to Family Calendar. We value your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and share your information.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">2. Data We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Account Data:</strong> Email address and profile information.</li>
              <li><strong>Calendar Data:</strong> Events, dates, times, and descriptions you add to the calendar.</li>
              <li><strong>Relationship Data:</strong> Connections you make with other users in the app.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">3. How We Use Your Data</h2>
            <p>We use your data strictly to provide and improve the Family Calendar service, including:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Displaying your events and coordinating with connected family members.</li>
              <li>Processing calendar screenshots via OCR to automatically create events.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">4. Data Sharing and Privacy</h2>
            <p>Your data is private. Events are only visible to you and the users you have explicitly connected with. We do not sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">5. Your Rights (GDPR)</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Access the personal data we hold about you.</li>
              <li>Request the correction of inaccurate personal data.</li>
              <li>Request the deletion of your personal data ("right to be forgotten").</li>
              <li>Export your data at any time.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">6. Contact Us</h2>
            <p>If you have any questions about this privacy policy, please contact the administrator.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

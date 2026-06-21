import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { GraduationCap, Building2, ArrowRight } from "lucide-react";
import { S } from "@/lib/styles";
import { cn } from "@/lib/cn";
import toast from "react-hot-toast";

export default function SchoolSetup() {
  const { profile, setupSchool } = useAuth();
  const [schoolName, setSchoolName] = useState("");
  const [busy, setBusy] = useState(false);

  const isAdmin = profile?.role === "schoolAdmin";

  const handleSetup = async () => {
    if (!schoolName.trim()) { toast.error("Enter school name"); return; }
    setBusy(true);
    try {
      const id = await setupSchool(schoolName);
      toast.success("School created! Share this code with teachers:\n" + id);
      // Auth context will auto-update the profile, triggering re-render
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create school");
    }
    setBusy(false);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 p-4">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-600 shadow-lg shadow-primary-200 mb-6">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Waiting for School Access</h1>
          <p className="text-gray-500 text-sm mb-6">Your account is registered. Please ask your school admin to share the School Code so you can be linked to the school.</p>
          <p className="text-gray-400 text-xs">If you already entered a code during registration, your admin may need to approve access.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 p-4">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-600 shadow-lg shadow-primary-200 mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Setup Your School</h1>
          <p className="text-gray-500 mt-1 text-sm">Create your school to get started</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 sm:p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">School Name</label>
            <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className={S.input} placeholder="e.g. Delhi Public School" />
          </div>

          <button onClick={handleSetup} disabled={busy} className={cn(S.btnPrimary, "w-full py-3")}>
            {busy ? "Creating…" : <><ArrowRight className="w-4 h-4" />Create School</>}
          </button>

          <p className="text-xs text-gray-400 text-center">After creating, you'll get a School Code to share with your teachers.</p>
        </div>
      </motion.div>
    </div>
  );
}

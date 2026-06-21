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
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create school");
    }
    setBusy(false);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
        <div className="w-full max-w-md text-center space-y-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg mb-2">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Waiting for School Access</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Your account is registered. Please ask your school admin to share the School Code so you can be linked to the school.</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-4">If you already entered a code during registration, your admin may need to approve access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-600 shadow-lg mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Setup Your School</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Create your school to get started</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-6">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">School Name</label>
            <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className={S.input} placeholder="e.g. Delhi Public School" />
            <button onClick={handleSetup} disabled={busy} className={cn(S.btnPrimary, "w-full")}>
              {busy ? "Creating…" : <><Building2 className="w-4 h-4" />Create School</>}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">After creating, you'll get a School Code to share with your teachers.</p>
        </motion.div>
      </div>
    </div>
  );
}

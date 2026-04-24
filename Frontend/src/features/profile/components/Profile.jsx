import { useState, useEffect } from "react";
import { useGetMe } from "../../auth/hooks/useAuth";
import { Input } from "../../../components/common/input";
import axios from "axios";
import { toast } from "sonner";
import TopNav from "../../../components/layout/TopNav/TopNav";
import Sidebar from "../../../components/layout/Sidebar/Sidebar";

export default function Profile() {
  const { user, refetch } = useGetMe();
  const [mobileNo, setMobileNo] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user?.mobileNo) {
      setMobileNo(user.mobileNo);
    }
  }, [user]);

  const handleSave = async () => {
    try {
      setIsLoading(true);
      await axios.put(
        "http://localhost:3000/api/auth/profile",
        { mobileNo },
        { withCredentials: true }
      );
      toast.success("Profile updated successfully!");
      setIsEditing(false);
      refetch(); // if refetch is provided by useGetMe, or we just rely on state
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update profile.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex w-full flex-col">
        <TopNav />
        <main className="flex-1 p-8">
          <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
            <h1 className="mb-6 text-2xl font-semibold text-slate-900">Your Profile</h1>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900">
                  {user?.username || "N/A"}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900">
                  {user?.email || "N/A"}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number</label>
                {isEditing ? (
                  <div className="flex gap-3">
                    <Input
                      value={mobileNo}
                      onChange={(e) => setMobileNo(e.target.value)}
                      placeholder="Enter mobile number"
                      className="flex-1"
                    />
                    <button
                      onClick={handleSave}
                      disabled={isLoading}
                      className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
                    >
                      {isLoading ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setMobileNo(user?.mobileNo || "");
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900">
                    <span>{user?.mobileNo || "Not provided"}</span>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-sm font-medium text-amber-600 hover:text-amber-700"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

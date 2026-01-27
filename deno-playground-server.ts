// Deno Playground Server - OnSpace App Data Access
// Deploy this to Deno Playground and share the URL

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// ⚠️ REPLACE THESE WITH YOUR ACTUAL VALUES FROM .env FILE
const SUPABASE_URL = "YOUR_SUPABASE_URL_HERE"; // e.g., https://xxxxx.backend.onspace.ai
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY_HERE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// CORS headers for browser access
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Root endpoint - API documentation
    if (path === "/" || path === "") {
      return new Response(
        JSON.stringify({
          status: "online",
          message: "OnSpace App Backend Data Access API",
          endpoints: {
            "/": "This documentation",
            "/health": "Health check and connection status",
            "/employees": "List all employees",
            "/employees/:id": "Get specific employee",
            "/surveys": "List all surveys (limit 100)",
            "/surveys/today": "Today's surveys",
            "/surveys/stats": "Survey statistics",
            "/time-entries": "Active time entries",
            "/time-entries/all": "All time entries (limit 100)",
            "/activity": "Recent activity logs",
            "/activity/inactive": "Inactive users (5+ min)",
            "/alerts": "All alerts",
            "/messages": "All messages",
            "/schedules": "All schedules",
            "/duplicates": "Duplicate surveys",
            "/stats": "Overall system statistics",
          },
          usage: "GET requests only. Append ?limit=N to paginate results.",
        }, null, 2),
        { headers: corsHeaders }
      );
    }

    // Health check
    if (path === "/health") {
      const { data, error } = await supabase
        .from("employees")
        .select("count")
        .limit(1);

      return new Response(
        JSON.stringify({
          status: error ? "error" : "connected",
          supabase_url: SUPABASE_URL,
          timestamp: new Date().toISOString(),
          error: error?.message,
        }, null, 2),
        { headers: corsHeaders }
      );
    }

    // Get all employees
    if (path === "/employees") {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify(data, null, 2), { headers: corsHeaders });
    }

    // Get specific employee
    if (path.startsWith("/employees/")) {
      const id = path.split("/")[2];
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data, null, 2), { headers: corsHeaders });
    }

    // Get all surveys
    if (path === "/surveys") {
      const limit = parseInt(url.searchParams.get("limit") || "100");
      const { data, error } = await supabase
        .from("surveys")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return new Response(JSON.stringify(data, null, 2), { headers: corsHeaders });
    }

    // Get today's surveys
    if (path === "/surveys/today") {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("surveys")
        .select("*")
        .gte("timestamp", `${today}T00:00:00Z`)
        .order("timestamp", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify(data, null, 2), { headers: corsHeaders });
    }

    // Get survey statistics
    if (path === "/surveys/stats") {
      const { data: allSurveys, error } = await supabase
        .from("surveys")
        .select("*");

      if (error) throw error;

      const today = new Date().toISOString().split("T")[0];
      const todaySurveys = allSurveys?.filter(s => s.timestamp.startsWith(today)) || [];

      const stats = {
        total_surveys: allSurveys?.length || 0,
        today_surveys: todaySurveys.length,
        by_category: {
          renter: allSurveys?.filter(s => s.category === "renter").length || 0,
          survey: allSurveys?.filter(s => s.category === "survey").length || 0,
          appointment: allSurveys?.filter(s => s.category === "appointment").length || 0,
        },
        by_store: {
          lowes: allSurveys?.filter(s => s.store === "lowes").length || 0,
          homedepot: allSurveys?.filter(s => s.store === "homedepot").length || 0,
        },
        sync_status: {
          synced_to_salesforce: allSurveys?.filter(s => s.synced_to_salesforce).length || 0,
          pending_salesforce: allSurveys?.filter(s => !s.synced_to_salesforce).length || 0,
        },
      };

      return new Response(JSON.stringify(stats, null, 2), { headers: corsHeaders });
    }

    // Get active time entries
    if (path === "/time-entries") {
      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          *,
          employees!inner(first_name, last_name, email)
        `)
        .is("clock_out", null)
        .order("clock_in", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify(data, null, 2), { headers: corsHeaders });
    }

    // Get all time entries
    if (path === "/time-entries/all") {
      const limit = parseInt(url.searchParams.get("limit") || "100");
      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          *,
          employees!inner(first_name, last_name, email)
        `)
        .order("clock_in", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return new Response(JSON.stringify(data, null, 2), { headers: corsHeaders });
    }

    // Get recent activity
    if (path === "/activity") {
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const { data, error } = await supabase
        .from("user_activity")
        .select(`
          *,
          employees!inner(first_name, last_name, email)
        `)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return new Response(JSON.stringify(data, null, 2), { headers: corsHeaders });
    }

    // Get inactive users
    if (path === "/activity/inactive") {
      const thresholdMinutes = parseInt(url.searchParams.get("threshold") || "5");
      
      // Get active time entries
      const { data: activeEntries, error: entriesError } = await supabase
        .from("time_entries")
        .select(`
          id,
          employee_id,
          store,
          clock_in,
          employees!inner(id, first_name, last_name)
        `)
        .is("clock_out", null);

      if (entriesError) throw entriesError;

      const inactiveUsers = [];
      const now = new Date();

      for (const entry of activeEntries || []) {
        const { data: lastActivity } = await supabase
          .from("user_activity")
          .select("created_at, page_path")
          .eq("employee_id", entry.employee_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!lastActivity) {
          const clockInTime = new Date(entry.clock_in);
          const inactiveDuration = Math.floor((now.getTime() - clockInTime.getTime()) / (1000 * 60));

          if (inactiveDuration >= thresholdMinutes) {
            inactiveUsers.push({
              employee_id: entry.employee_id,
              employee_name: `${entry.employees.first_name} ${entry.employees.last_name}`,
              time_entry_id: entry.id,
              last_activity: entry.clock_in,
              inactive_duration_minutes: inactiveDuration,
              current_page: null,
              store: entry.store,
            });
          }
          continue;
        }

        const lastActivityTime = new Date(lastActivity.created_at);
        const inactiveDuration = Math.floor((now.getTime() - lastActivityTime.getTime()) / (1000 * 60));

        if (inactiveDuration >= thresholdMinutes) {
          inactiveUsers.push({
            employee_id: entry.employee_id,
            employee_name: `${entry.employees.first_name} ${entry.employees.last_name}`,
            time_entry_id: entry.id,
            last_activity: lastActivity.created_at,
            inactive_duration_minutes: inactiveDuration,
            current_page: lastActivity.page_path,
            store: entry.store,
          });
        }
      }

      return new Response(JSON.stringify(inactiveUsers, null, 2), { headers: corsHeaders });
    }

    // Get all alerts
    if (path === "/alerts") {
      const { data, error } = await supabase
        .from("alerts")
        .select(`
          *,
          employees!alerts_sender_id_fkey(first_name, last_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify(data, null, 2), { headers: corsHeaders });
    }

    // Get all messages
    if (path === "/messages") {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          employees!messages_sender_id_fkey(first_name, last_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify(data, null, 2), { headers: corsHeaders });
    }

    // Get all schedules
    if (path === "/schedules") {
      const { data, error } = await supabase
        .from("schedules")
        .select(`
          *,
          employees!inner(first_name, last_name, email)
        `)
        .order("date", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify(data, null, 2), { headers: corsHeaders });
    }

    // Get duplicate surveys
    if (path === "/duplicates") {
      const { data, error } = await supabase
        .from("surveys")
        .select("*")
        .eq("is_duplicate", true)
        .order("timestamp", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify(data, null, 2), { headers: corsHeaders });
    }

    // Get overall system stats
    if (path === "/stats") {
      const [
        { data: employees },
        { data: surveys },
        { data: timeEntries },
        { data: alerts },
        { data: messages },
      ] = await Promise.all([
        supabase.from("employees").select("*"),
        supabase.from("surveys").select("*"),
        supabase.from("time_entries").select("*"),
        supabase.from("alerts").select("*"),
        supabase.from("messages").select("*"),
      ]);

      const activeEmployees = employees?.filter(e => e.status === "active") || [];
      const clockedIn = timeEntries?.filter(te => !te.clock_out) || [];
      const today = new Date().toISOString().split("T")[0];
      const todaySurveys = surveys?.filter(s => s.timestamp.startsWith(today)) || [];

      const stats = {
        employees: {
          total: employees?.length || 0,
          active: activeEmployees.length,
          clocked_in: clockedIn.length,
          by_role: {
            admin: employees?.filter(e => e.role === "admin").length || 0,
            manager: employees?.filter(e => e.role === "manager").length || 0,
            employee: employees?.filter(e => e.role === "employee").length || 0,
          },
        },
        surveys: {
          total: surveys?.length || 0,
          today: todaySurveys.length,
          appointments_total: surveys?.filter(s => s.category === "appointment").length || 0,
          appointments_today: todaySurveys.filter(s => s.category === "appointment").length,
        },
        time_entries: {
          total: timeEntries?.length || 0,
          currently_clocked_in: clockedIn.length,
        },
        communication: {
          total_alerts: alerts?.length || 0,
          total_messages: messages?.length || 0,
        },
        timestamp: new Date().toISOString(),
      };

      return new Response(JSON.stringify(stats, null, 2), { headers: corsHeaders });
    }

    // 404 for unknown endpoints
    return new Response(
      JSON.stringify({ error: "Endpoint not found", path }, null, 2),
      { status: 404, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        message: error.message,
        stack: error.stack 
      }, null, 2),
      { status: 500, headers: corsHeaders }
    );
  }
}

console.log("🚀 Server starting...");
console.log("📊 OnSpace App Data Access API");
console.log("🔗 Endpoints available at /");

serve(handler);

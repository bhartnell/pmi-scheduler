/*
 * Pre-Internship Self-Assessment: storage adapter.
 *
 * THIS IS THE ONLY FILE THAT NEEDS TO CHANGE TO CONNECT THE TOOL TO A REAL BACKEND.
 *
 * app.js calls the methods below and nothing else for persistence. Every method
 * returns a Promise. The demo version stores everything in this browser's
 * localStorage so the tool runs with no server. Replace each method body with
 * calls to pmiparamedic.tools' own API / database and auth.
 *
 * Demo roles: open index.html normally to act as a student; open
 * index.html?role=instructor to act as an instructor.
 *
 * DATA SHAPES (see HANDOFF.md for the full field list)
 *   Response  { v, name, cohort, email, ratings{domainId:1-4}, scenarios{scenarioId:"A"-"D"},
 *               reflections{r1,r2,r3}, prefs{learn,feedback,autonomy,challenges[]}, ack, submittedAt }
 *   Review    { instr{domainId:1-4}, academic{cog,skills},
 *               summary{strengths,growth,match,comments}, preparedBy, updatedAt, recordKey }
 *
 * ACCESS RULES THE REAL BACKEND MUST ENFORCE (server side, not just in the UI)
 *   - A student can read and write only their own Response.
 *   - Students can never read other students' Responses or any Review.
 *   - Instructors can read every Response and read/write every Review.
 */
(function(){
  const params = new URLSearchParams(location.search);
  const DEMO_ROLE = params.get("role") === "instructor" ? "instructor" : "student";
  const DEMO_STUDENT_ID = "demo-student";
  const K = { responses: "sa-demo-responses", reviews: "sa-demo-reviews" };
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch (e) { return {}; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { throw new Error("storage unavailable"); } };

  window.SA_STORAGE = {
    /** true if the signed-in user is an instructor (shows the Instructor review tab). */
    async isInstructor() {
      return DEMO_ROLE === "instructor";
    },

    /** The signed-in student's own Response, or null if they haven't submitted. */
    async getMyResponse() {
      return read(K.responses)[DEMO_STUDENT_ID] || null;
    },

    /** Create or replace the signed-in student's own Response. Throw on failure. */
    async saveMyResponse(response) {
      const all = read(K.responses);
      all[DEMO_STUDENT_ID] = { ...response, source: "form" };
      write(K.responses, all);
    },

    /** Instructor only. Every Response as [{ id, data }]; id is a stable per-student key. */
    async listResponses() {
      return Object.entries(read(K.responses)).map(([id, data]) => ({ id, data }));
    },

    /** Instructor only. Remove one student's Response (used for test or duplicate records). */
    async deleteResponse(id) {
      const all = read(K.responses); delete all[id]; write(K.responses, all);
    },

    /** Instructor only. Every Review as an object keyed by recordKey ("r-" + response id). */
    async listReviews() {
      return read(K.reviews);
    },

    /** Instructor only. Create or replace one Review. Throw on failure. */
    async saveReview(recordKey, review) {
      const all = read(K.reviews); all[recordKey] = review; write(K.reviews, all);
    },

    /** Instructor only. Remove one Review. */
    async deleteReview(recordKey) {
      const all = read(K.reviews); delete all[recordKey]; write(K.reviews, all);
    }

    /* Optional: download(filename, text) — provide this only if the site needs a
       custom file-save path. If omitted, app.js uses a normal browser download. */
  };
})();

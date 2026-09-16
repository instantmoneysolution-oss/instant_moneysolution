document.addEventListener("DOMContentLoaded", async () => {

  /* ===============================
     CHECK SUPABASE CONNECTION
  =============================== */

  if (!window.supabaseClient) {
    const loginMessage = document.getElementById("login-message");

    if (loginMessage) {
      loginMessage.textContent =
        "Supabase is not connected. Check supabase-config.js.";
    }

    console.error("Supabase client not found.");

    return;
  }

  console.log("Supabase connected successfully.");


  /* ===============================
     ELEMENTS
  =============================== */

  const loginSection = document.getElementById("login-section");
  const dashboard = document.getElementById("dashboard-section");
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const reviewsEl = document.getElementById("admin-reviews");
  const adminMessage = document.getElementById("admin-message");
  const logout = document.getElementById("logout-btn");
  const tabs = document.querySelectorAll(".tab");

  let currentStatus = "pending";


  /* ===============================
     ESCAPE HTML
  =============================== */

  function esc(value) {

    const div = document.createElement("div");

    div.textContent = value ?? "";

    return div.innerHTML;
  }


  /* ===============================
     CHECK ADMIN SESSION
  =============================== */

  async function checkSession() {

    const {
      data: sessionData,
      error: sessionError
    } = await window.supabaseClient.auth.getSession();


    if (sessionError) {

      console.error(
        "Session error:",
        sessionError
      );

      loginMessage.textContent =
        sessionError.message;

      return;
    }


    const session = sessionData.session;


    /* No login */

    if (!session) {

      loginSection.hidden = false;
      dashboard.hidden = true;

      return;
    }


    /* ===============================
       CHECK ADMIN
    =============================== */

    const {
      data: admin,
      error: adminError
    } = await window.supabaseClient
      .from("review_admins")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();


    if (adminError) {

      console.error(
        "Admin check error:",
        adminError
      );

      loginMessage.textContent =
        adminError.message;

      return;
    }


    if (!admin) {

      await window.supabaseClient.auth.signOut();

      loginMessage.textContent =
        "This account is not authorized as a review admin.";

      return;
    }


    /* ===============================
       SHOW DASHBOARD
    =============================== */

    loginSection.hidden = true;
    dashboard.hidden = false;

    loadReviews(currentStatus);
  }


  /* ===============================
     LOGIN
  =============================== */

  loginForm?.addEventListener(
    "submit",
    async (e) => {

      e.preventDefault();

      loginMessage.textContent =
        "Logging in...";


      const email =
        document
          .getElementById("admin-email")
          .value
          .trim();


      const password =
        document
          .getElementById("admin-password")
          .value;


      const {
        error
      } = await window.supabaseClient.auth
        .signInWithPassword({
          email,
          password
        });


      if (error) {

        console.error(
          "Login error:",
          error
        );

        loginMessage.textContent =
          error.message;

        return;
      }


      loginMessage.textContent = "";

      await checkSession();
    }
  );


  /* ===============================
     LOGOUT
  =============================== */

  logout?.addEventListener(
    "click",
    async () => {

      await window.supabaseClient.auth.signOut();

      location.reload();
    }
  );


  /* ===============================
     TABS
  =============================== */

  tabs.forEach((tab) => {

    tab.addEventListener(
      "click",
      () => {

        tabs.forEach((item) => {

          item.classList.remove("active");

        });


        tab.classList.add("active");


        currentStatus =
          tab.dataset.status;


        loadReviews(currentStatus);
      }
    );

  });


  /* ===============================
     LOAD REVIEWS
  =============================== */

  async function loadReviews(status) {

    reviewsEl.innerHTML =
      "<p>Loading...</p>";


    console.log(
      "Loading",
      status,
      "reviews..."
    );


    const {
      data,
      error
    } = await window.supabaseClient
      .from("reviews")
      .select(
        "id,name,rating,review,status,created_at"
      )
      .eq("status", status)
      .order(
        "created_at",
        {
          ascending: false
        }
      );


    if (error) {

      console.error(
        "Load reviews error:",
        error
      );

      reviewsEl.innerHTML =
        "<p>Unable to load reviews.</p>";

      return;
    }


    console.log(
      "Reviews loaded:",
      data
    );


    /* No reviews */

    if (!data || !data.length) {

      reviewsEl.innerHTML = `
        <div class="admin-card">
          <p>No ${esc(status)} reviews.</p>
        </div>
      `;

      return;
    }


    /* ===============================
       DISPLAY REVIEWS
    =============================== */

    reviewsEl.innerHTML = data
      .map((item) => {

        const rating =
          Number(item.rating);


        const stars =
          "★".repeat(rating) +
          "☆".repeat(5 - rating);


        let actions = "";


        if (status === "pending") {

          actions = `
            <button
              class="approve-btn"
              data-action="approved"
              data-id="${item.id}">
              Approve
            </button>

            <button
              class="reject-btn"
              data-action="rejected"
              data-id="${item.id}">
              Reject
            </button>
          `;

        }

        else if (status === "rejected") {

          actions = `
            <button
              class="approve-btn"
              data-action="approved"
              data-id="${item.id}">
              Approve
            </button>
          `;

        }

        else {

          actions = `
            <button
              class="reject-btn"
              data-action="rejected"
              data-id="${item.id}">
              Reject
            </button>
          `;
        }


        actions += `
          <button
            class="delete-btn"
            data-action="delete"
            data-id="${item.id}">
            Delete
          </button>
        `;


        return `
          <article
            class="review-admin-card"
            data-review-id="${item.id}">

            <div class="review-admin-top">

              <strong>
                ${esc(item.name)}
              </strong>

              <span class="review-admin-stars">
                ${stars}
              </span>

            </div>


            <p class="review-admin-text">
              ${esc(item.review)}
            </p>


            <small class="review-admin-date">
              ${new Date(
                item.created_at
              ).toLocaleString("en-IN")}
            </small>


            <div class="review-admin-actions">
              ${actions}
            </div>

          </article>
        `;

      })
      .join("");


    /* ===============================
       ACTION BUTTONS
    =============================== */

    reviewsEl
      .querySelectorAll("[data-action]")
      .forEach((button) => {

        button.addEventListener(
          "click",
          () => {

            const actionType =
              button.dataset.action;

            const reviewId =
              button.dataset.id;


            action(
              actionType,
              reviewId,
              button
            );
          }
        );

      });
  }


  /* ===============================
     APPROVE / REJECT / DELETE
  =============================== */

  async function action(
    actionType,
    id,
    button
  ) {

    if (!id) {

      adminMessage.textContent =
        "Could not identify review.";

      return;
    }


    adminMessage.textContent =
      "Updating...";


    button.disabled = true;


    let result;


    /* DELETE */

    if (actionType === "delete") {

      result =
        await window.supabaseClient
          .from("reviews")
          .delete()
          .eq("id", id);

    }


    /* APPROVE / REJECT */

    else {

      result =
        await window.supabaseClient
          .from("reviews")
          .update({
            status: actionType,
            updated_at:
              new Date().toISOString()
          })
          .eq("id", id);
    }


    /* ERROR */

    if (result.error) {

      console.error(
        "Review action error:",
        result.error
      );

      adminMessage.textContent =
        result.error.message;

      button.disabled = false;

      return;
    }


    /* SUCCESS */

    adminMessage.textContent =
      "Updated successfully.";


    await loadReviews(
      currentStatus
    );
  }


  /* ===============================
     START
  =============================== */

  await checkSession();

});
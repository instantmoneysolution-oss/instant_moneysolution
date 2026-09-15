/* Customer Review System */

document.addEventListener("DOMContentLoaded", () => {

    const modal = document.getElementById("review-modal");
    const openBtn = document.getElementById("open-review-btn");
    const closeBtn = document.getElementById("close-review-btn");
    const form = document.getElementById("review-form");

    const nameInput = document.getElementById("review-name");
    const textInput = document.getElementById("review-text");
    const ratingInput = document.getElementById("review-rating");

    const submitBtn = document.getElementById("submit-review-btn");
    const message = document.getElementById("review-message");

    const stars = document.querySelectorAll("#star-rating button");

    const list = document.getElementById("reviews-list");
    const avg = document.getElementById("average-rating");
    const avgStars = document.getElementById("average-stars");
    const count = document.getElementById("review-count");


    /* Check Supabase connection */
    if (!window.supabaseClient) {

        console.error(
            "Supabase client was not found. Check supabase-config.js"
        );

        if (list) {
            list.innerHTML =
                '<p class="no-reviews">Review system is not connected.</p>';
        }

        return;
    }

    console.log("Supabase connected successfully.");


    /* Open Review Modal */
    function openModal() {

        if (!modal) return;

        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");

        document.body.style.overflow = "hidden";
    }


    /* Close Review Modal */
    function closeModal() {

        if (!modal) return;

        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");

        document.body.style.overflow = "";
    }


    /* Modal Events */
    openBtn?.addEventListener("click", openModal);

    closeBtn?.addEventListener("click", closeModal);

    modal?.addEventListener("click", (e) => {

        if (e.target === modal) {
            closeModal();
        }

    });


    /* Escape key */
    document.addEventListener("keydown", (e) => {

        if (
            e.key === "Escape" &&
            modal?.classList.contains("active")
        ) {
            closeModal();
        }

    });


    /* Star Rating */
    stars.forEach((star) => {

        star.addEventListener("click", () => {

            const rating = Number(star.dataset.rating);

            ratingInput.value = rating;

            stars.forEach((s) => {

                const starRating = Number(s.dataset.rating);

                s.classList.toggle(
                    "active",
                    starRating <= rating
                );

            });

        });

    });


    /* Prevent HTML injection */
    function escapeHTML(value) {

        const div = document.createElement("div");

        div.textContent = value ?? "";

        return div.innerHTML;
    }


    /* Message */
    function setMessage(text, error = false) {

        if (!message) return;

        message.textContent = text;

        message.style.color = error
            ? "#d93025"
            : "#16803c";
    }


    /* Update Rating Summary */
    function updateSummary(reviews) {

        if (!count || !avg || !avgStars) return;

        count.textContent = reviews.length;

        if (!reviews.length) {

            avg.textContent = "0.0";
            avgStars.textContent = "☆☆☆☆☆";

            return;
        }

        const total = reviews.reduce(
            (sum, review) => sum + Number(review.rating),
            0
        );

        const average = total / reviews.length;

        const rounded = Math.round(average);

        avg.textContent = average.toFixed(1);

        avgStars.textContent =
            "★".repeat(rounded) +
            "☆".repeat(5 - rounded);
    }


    /* Display Reviews */
    function renderReviews(reviews) {

        if (!list) return;

        if (!reviews.length) {

            list.innerHTML = `
                <div class="no-reviews">
                    <p>No reviews yet.</p>
                    <p>Be the first customer to write a review!</p>
                </div>
            `;

            return;
        }


        list.innerHTML = reviews.map((item) => {

            const rating = Number(item.rating);

            const date = new Date(
                item.created_at
            ).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric"
            });


            return `
                <article class="review-card">

                    <div class="review-card-header">

                        <h3 class="review-card-name">
                            ${escapeHTML(item.name)}
                        </h3>

                        <div class="review-card-stars">
                            ${"★".repeat(rating)}
                            ${"☆".repeat(5 - rating)}
                        </div>

                    </div>

                    <p class="review-card-text">
                        ${escapeHTML(item.review)}
                    </p>

                    <small class="review-card-date">
                        ${date}
                    </small>

                </article>
            `;

        }).join("");
    }


    /* Load Approved Reviews */
    async function loadReviews() {

        console.log("Loading reviews...");

        const {
            data,
            error
        } = await window.supabaseClient
            .from("reviews")
            .select(
                "id,name,rating,review,created_at"
            )
            .eq("status", "approved")
            .order("created_at", {
                ascending: false
            });


        if (error) {

            console.error(
                "Supabase review error:",
                error
            );

            if (list) {

                list.innerHTML =
                    '<p class="no-reviews">Unable to load reviews.</p>';

            }

            return;
        }


        console.log(
            "Reviews received:",
            data
        );


        updateSummary(data || []);

        renderReviews(data || []);
    }


    /* Submit Review */
    form?.addEventListener("submit", async (e) => {

        e.preventDefault();


        const name = nameInput.value.trim();

        const review = textInput.value.trim();

        const rating = Number(
            ratingInput.value
        );


        /* Validation */

        if (name.length < 2) {

            setMessage(
                "Please enter your name.",
                true
            );

            return;
        }


        if (rating < 1 || rating > 5) {

            setMessage(
                "Please select a rating.",
                true
            );

            return;
        }


        if (review.length < 5) {

            setMessage(
                "Please write a longer review.",
                true
            );

            return;
        }


        /* Disable button */

        submitBtn.disabled = true;

        submitBtn.textContent = "Submitting...";


        console.log("Submitting review...");


        /* Insert review */

        const {
            error
        } = await window.supabaseClient
            .from("reviews")
            .insert([
                {
                    name: name,
                    rating: rating,
                    review: review,
                    status: "pending"
                }
            ]);


        /* Error */

        if (error) {

            console.error(
                "Review submission error:",
                error
            );

            setMessage(
                "Something went wrong. Please try again.",
                true
            );

        }


        /* Success */

        else {

            setMessage(
                "Thank you! Your review has been submitted and is waiting for approval."
            );


            form.reset();

            ratingInput.value = 0;


            stars.forEach((star) => {

                star.classList.remove("active");

            });


            setTimeout(() => {

                closeModal();

                if (message) {
                    message.textContent = "";
                }

            }, 2500);

        }


        /* Enable button */

        submitBtn.disabled = false;

        submitBtn.textContent = "Submit Review";

    });


    /* Start */
    loadReviews();

});
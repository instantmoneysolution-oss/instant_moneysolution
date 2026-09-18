/* =========================================
   CUSTOMER REVIEW SYSTEM
   NON-INFINITE SLIDER
========================================= */

document.addEventListener("DOMContentLoaded", () => {


    /* =========================================
       ELEMENTS
    ========================================= */

    const modal =
        document.getElementById("review-modal");

    const openBtn =
        document.getElementById("open-review-btn");

    const closeBtn =
        document.getElementById("close-review-btn");

    const form =
        document.getElementById("review-form");


    const nameInput =
        document.getElementById("review-name");

    const textInput =
        document.getElementById("review-text");

    const ratingInput =
        document.getElementById("review-rating");


    const submitBtn =
        document.getElementById("submit-review-btn");

    const message =
        document.getElementById("review-message");


    const stars =
        document.querySelectorAll(
            "#star-rating button"
        );


    const list =
        document.getElementById("reviews-list");

    const track =
        document.getElementById("reviews-track");


    const avg =
        document.getElementById("average-rating");

    const avgStars =
        document.getElementById("average-stars");

    const count =
        document.getElementById("review-count");


    const prevBtn =
        document.getElementById("reviews-prev");

    const nextBtn =
        document.getElementById("reviews-next");


    /* =========================================
       CHECK SUPABASE
    ========================================= */

    if (!window.supabaseClient) {

        console.error(
            "Supabase client was not found. " +
            "Check supabase-config.js"
        );


        if (list) {

            list.innerHTML = `
                <p class="no-reviews">
                    Review system is not connected.
                </p>
            `;
        }

        return;
    }


    console.log(
        "Supabase connected successfully."
    );


    /* =========================================
       SLIDER VARIABLES
    ========================================= */

    let allReviews = [];

    let currentIndex = 0;

    let reviewsPerView = 3;


    /* =========================================
       GET REVIEWS PER VIEW
    ========================================= */

    function getReviewsPerView() {

        const width =
            window.innerWidth;


        if (width <= 650) {

            return 1;
        }


        if (width <= 900) {

            return 2;
        }


        return 3;
    }


    /* =========================================
       ESCAPE HTML
    ========================================= */

    function escapeHTML(value) {

        const div =
            document.createElement("div");

        div.textContent =
            value ?? "";

        return div.innerHTML;
    }


    /* =========================================
       MESSAGE
    ========================================= */

    function setMessage(
        text,
        error = false
    ) {

        if (!message) return;


        message.textContent =
            text;


        message.style.color =
            error
                ? "#d93025"
                : "#16803c";
    }


    /* =========================================
       UPDATE RATING SUMMARY
    ========================================= */

    function updateSummary(
        reviews
    ) {

        if (
            !count ||
            !avg ||
            !avgStars
        ) {
            return;
        }


        count.textContent =
            reviews.length;


        if (!reviews.length) {

            avg.textContent =
                "0.0";

            avgStars.textContent =
                "☆☆☆☆☆";

            return;
        }


        const total =
            reviews.reduce(
                (sum, review) => {

                    return (
                        sum +
                        Number(
                            review.rating
                        )
                    );

                },
                0
            );


        const average =
            total /
            reviews.length;


        const rounded =
            Math.round(
                average
            );


        avg.textContent =
            average.toFixed(1);


        avgStars.textContent =
            "★".repeat(rounded) +
            "☆".repeat(
                5 - rounded
            );
    }


    /* =========================================
       CREATE REVIEW CARD
    ========================================= */

    function createReviewCard(
        item
    ) {

        const rating =
            Math.max(
                0,
                Math.min(
                    5,
                    Number(
                        item.rating
                    )
                )
            );


        const date =
            new Date(
                item.created_at
            ).toLocaleDateString(
                "en-IN",
                {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                }
            );


        return `

            <article class="review-card">

                <div class="review-card-header">

                    <h3 class="review-card-name">
                        ${escapeHTML(
                            item.name
                        )}
                    </h3>

                    <div
                        class="review-card-stars"
                        aria-label="${rating} out of 5 stars">

                        ${"★".repeat(
                            rating
                        )}

                        ${"☆".repeat(
                            5 - rating
                        )}

                    </div>

                </div>


                <p class="review-card-text">

                    ${escapeHTML(
                        item.review
                    )}

                </p>


                <small class="review-card-date">

                    ${date}

                </small>

            </article>

        `;
    }


    /* =========================================
       RENDER REVIEWS
    ========================================= */

    function renderReviews() {

        if (!track) return;


        reviewsPerView =
            getReviewsPerView();


        /* No reviews */

        if (
            allReviews.length === 0
        ) {

            track.innerHTML = `

                <div class="no-reviews">

                    <p>
                        No reviews yet.
                    </p>

                    <p>
                        Be the first customer
                        to write a review!
                    </p>

                </div>

            `;


            track.style.transform =
                "translateX(0)";


            updateSliderButtons();

            return;
        }


        /*
            Get only the reviews
            currently visible.
        */

        const visibleReviews =
            allReviews.slice(
                currentIndex,
                currentIndex +
                reviewsPerView
            );


        track.innerHTML =
            visibleReviews
                .map(createReviewCard)
                .join("");


        /*
            Small slide animation
        */

        track.style.transform =
            "translateX(20px)";


        track.style.opacity =
            "0";


        requestAnimationFrame(() => {

            track.style.transform =
                "translateX(0)";

            track.style.opacity =
                "1";

        });


        updateSliderButtons();
    }


    /* =========================================
       NEXT
    ========================================= */

    function showNextReview() {

        reviewsPerView =
            getReviewsPerView();


        /*
            Stop at the end.
        */

        if (
            currentIndex +
            reviewsPerView >=
            allReviews.length
        ) {

            return;
        }


        currentIndex++;


        renderReviews();
    }


    /* =========================================
       PREVIOUS
    ========================================= */

    function showPreviousReview() {


        /*
            Stop at the beginning.
        */

        if (
            currentIndex <= 0
        ) {

            return;
        }


        currentIndex--;


        renderReviews();
    }


    /* =========================================
       UPDATE BUTTONS
    ========================================= */

    function updateSliderButtons() {

        if (
            !prevBtn ||
            !nextBtn
        ) {
            return;
        }


        reviewsPerView =
            getReviewsPerView();


        /*
            Previous
        */

        prevBtn.disabled =
            currentIndex <= 0;


        /*
            Next
        */

        nextBtn.disabled =
            currentIndex +
            reviewsPerView >=
            allReviews.length;
    }


    /* =========================================
       BUTTON EVENTS
    ========================================= */

    nextBtn?.addEventListener(
        "click",
        showNextReview
    );


    prevBtn?.addEventListener(
        "click",
        showPreviousReview
    );


    /* =========================================
       WINDOW RESIZE
    ========================================= */

    window.addEventListener(
        "resize",
        () => {

            const newPerView =
                getReviewsPerView();


            if (
                newPerView !==
                reviewsPerView
            ) {

                reviewsPerView =
                    newPerView;


                const maxIndex =
                    Math.max(
                        0,
                        allReviews.length -
                        reviewsPerView
                    );


                currentIndex =
                    Math.min(
                        currentIndex,
                        maxIndex
                    );


                renderReviews();
            }
        }
    );


    /* =========================================
       REVIEW MODAL
    ========================================= */

    function openModal() {

        if (!modal) return;


        modal.classList.add(
            "active"
        );


        modal.setAttribute(
            "aria-hidden",
            "false"
        );


        document.body.style.overflow =
            "hidden";
    }


    function closeModal() {

        if (!modal) return;


        modal.classList.remove(
            "active"
        );


        modal.setAttribute(
            "aria-hidden",
            "true"
        );


        document.body.style.overflow =
            "";
    }


    openBtn?.addEventListener(
        "click",
        openModal
    );


    closeBtn?.addEventListener(
        "click",
        closeModal
    );


    modal?.addEventListener(
        "click",
        (event) => {

            if (
                event.target === modal
            ) {

                closeModal();
            }
        }
    );


    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Escape" &&
                modal?.classList.contains(
                    "active"
                )
            ) {

                closeModal();
            }
        }
    );


    /* =========================================
       STAR RATING
    ========================================= */

    stars.forEach(
        (star) => {

            star.addEventListener(
                "click",
                () => {

                    const rating =
                        Number(
                            star.dataset.rating
                        );


                    if (ratingInput) {

                        ratingInput.value =
                            rating;
                    }


                    stars.forEach(
                        (s) => {

                            const starRating =
                                Number(
                                    s.dataset.rating
                                );


                            s.classList.toggle(
                                "active",
                                starRating <=
                                rating
                            );

                        }
                    );
                }
            );
        }
    );


    /* =========================================
       LOAD REVIEWS
    ========================================= */

    async function loadReviews() {

        console.log(
            "Loading reviews..."
        );


        const {
            data,
            error
        } =
            await window.supabaseClient
                .from("reviews")
                .select(
                    "id,name,rating,review,created_at"
                )
                .eq(
                    "status",
                    "approved"
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error) {

            console.error(
                "Supabase review error:",
                error
            );


            if (track) {

                track.innerHTML = `

                    <div class="no-reviews">
                        Unable to load reviews.
                    </div>

                `;
            }


            return;
        }


        console.log(
            "Reviews received:",
            data
        );


        allReviews =
            data || [];


        currentIndex =
            0;


        updateSummary(
            allReviews
        );


        renderReviews();
    }


    /* =========================================
       SUBMIT REVIEW
    ========================================= */

    form?.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const name =
                nameInput?.value.trim() ||
                "";


            const review =
                textInput?.value.trim() ||
                "";


            const rating =
                Number(
                    ratingInput?.value
                );


            /* Name validation */

            if (
                name.length < 2
            ) {

                setMessage(
                    "Please enter your name.",
                    true
                );

                return;
            }


            /* Rating validation */

            if (
                rating < 1 ||
                rating > 5
            ) {

                setMessage(
                    "Please select a rating.",
                    true
                );

                return;
            }


            /* Review validation */

            if (
                review.length < 5
            ) {

                setMessage(
                    "Please write a longer review.",
                    true
                );

                return;
            }


            if (submitBtn) {

                submitBtn.disabled =
                    true;

                submitBtn.textContent =
                    "Submitting...";
            }


            console.log(
                "Submitting review..."
            );


            const {
                error
            } =
                await window.supabaseClient
                    .from("reviews")
                    .insert([
                        {
                            name:
                                name,

                            rating:
                                rating,

                            review:
                                review,

                            status:
                                "pending"
                        }
                    ]);


            if (error) {

                console.error(
                    "Review submission error:",
                    error
                );


                setMessage(
                    "Something went wrong. Please try again.",
                    true
                );

            } else {

                setMessage(
                    "Thank you! Your review has been submitted and is waiting for approval."
                );


                form.reset();


                if (ratingInput) {

                    ratingInput.value =
                        0;
                }


                stars.forEach(
                    (star) => {

                        star.classList.remove(
                            "active"
                        );
                    }
                );


                setTimeout(
                    () => {

                        closeModal();


                        if (message) {

                            message.textContent =
                                "";
                        }

                    },
                    2500
                );
            }


            if (submitBtn) {

                submitBtn.disabled =
                    false;

                submitBtn.textContent =
                    "Submit Review";
            }

        }
    );


    /* =========================================
       START
    ========================================= */

    loadReviews();

});
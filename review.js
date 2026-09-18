/* =========================================
   CUSTOMER REVIEW SYSTEM
   INFINITE SLIDER + SUPABASE
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =========================================
       ELEMENTS
    ========================================= */

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
    const track = document.getElementById("reviews-track");

    const avg = document.getElementById("average-rating");
    const avgStars = document.getElementById("average-stars");
    const count = document.getElementById("review-count");

    const prevBtn = document.getElementById("reviews-prev");
    const nextBtn = document.getElementById("reviews-next");


    /* =========================================
       SUPABASE CHECK
    ========================================= */

    if (!window.supabaseClient) {

        console.error(
            "Supabase client was not found. Check supabase-config.js"
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

    console.log("Supabase connected successfully.");


    /* =========================================
       SLIDER VARIABLES
    ========================================= */

    let allReviews = [];

    let currentIndex = 0;

    let reviewsPerView = 3;

    let autoSlideTimer = null;

    let isAnimating = false;


    /* =========================================
       HOW MANY REVIEWS ARE VISIBLE
    ========================================= */

    function getReviewsPerView() {

        const width = window.innerWidth;

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

        const div = document.createElement("div");

        div.textContent = value ?? "";

        return div.innerHTML;
    }


    /* =========================================
       MESSAGE
    ========================================= */

    function setMessage(text, error = false) {

        if (!message) return;

        message.textContent = text;

        message.style.color =
            error ? "#d93025" : "#16803c";
    }


    /* =========================================
       UPDATE RATING SUMMARY
    ========================================= */

    function updateSummary(reviews) {

        if (!count || !avg || !avgStars) return;

        count.textContent = reviews.length;

        if (!reviews.length) {

            avg.textContent = "0.0";

            avgStars.textContent = "☆☆☆☆☆";

            return;
        }

        const total = reviews.reduce(
            (sum, review) =>
                sum + Number(review.rating),
            0
        );

        const average =
            total / reviews.length;

        const rounded =
            Math.round(average);

        avg.textContent =
            average.toFixed(1);

        avgStars.textContent =
            "★".repeat(rounded) +
            "☆".repeat(5 - rounded);
    }


    /* =========================================
       CREATE REVIEW CARD
    ========================================= */

    function createReviewCard(item) {

        const rating = Math.max(
            0,
            Math.min(5, Number(item.rating))
        );

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

                    <div
                        class="review-card-stars"
                        aria-label="${rating} out of 5 stars">

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
    }


    /* =========================================
       BUILD SLIDER
    ========================================= */

    function buildSlider() {

        if (!track) return;

        reviewsPerView =
            getReviewsPerView();

        currentIndex =
            reviewsPerView;


        /* No reviews */

        if (!allReviews.length) {

            track.innerHTML = `
                <div class="no-reviews">

                    <p>No reviews yet.</p>

                    <p>
                        Be the first customer
                        to write a review!
                    </p>

                </div>
            `;

            track.style.transform =
                "translateX(0)";

            return;
        }


        /*
            If there are fewer reviews than
            the visible number, don't clone.
        */

        if (allReviews.length <= reviewsPerView) {

            track.innerHTML =
                allReviews
                    .map(createReviewCard)
                    .join("");

            track.style.transform =
                "translateX(0)";

            if (prevBtn) {
                prevBtn.style.display = "none";
            }

            if (nextBtn) {
                nextBtn.style.display = "none";
            }

            stopAutoSlide();

            return;
        }


        /* Show navigation */

        if (prevBtn) {
            prevBtn.style.display = "flex";
        }

        if (nextBtn) {
            nextBtn.style.display = "flex";
        }


        /*
            Clone reviews for infinite loop.

            Example:

            Original:
            1 2 3 4 5

            Result:
            4 5 | 1 2 3 4 5 | 1 2

            This allows us to move forever.
        */

        const beforeClones =
            allReviews.slice(-reviewsPerView);

        const afterClones =
            allReviews.slice(0, reviewsPerView);

        const sliderReviews = [
            ...beforeClones,
            ...allReviews,
            ...afterClones
        ];


        track.innerHTML =
            sliderReviews
                .map(createReviewCard)
                .join("");


        /*
            Start at the first real review.
        */

        requestAnimationFrame(() => {

            moveSlider(false);

        });
    }


    /* =========================================
       MOVE SLIDER
    ========================================= */

    function moveSlider(animate = true) {

        if (!track) return;

        const cards =
            track.querySelectorAll(".review-card");

        if (!cards.length) return;


        /*
            Card width + gap
        */

        const cardWidth =
            cards[0].getBoundingClientRect().width;

        const gap =
            parseFloat(
                getComputedStyle(track).gap
            ) || 0;

        const moveAmount =
            cardWidth + gap;


        if (!animate) {

            track.style.transition =
                "none";

        } else {

            track.style.transition =
                "transform 0.5s ease";
        }


        const translateAmount =
            currentIndex * moveAmount;

        track.style.transform =
            `translateX(-${translateAmount}px)`;
    }


    /* =========================================
       NEXT REVIEW
    ========================================= */

    function showNextReview() {

        if (
            allReviews.length <= reviewsPerView ||
            isAnimating
        ) {
            return;
        }

        isAnimating = true;

        currentIndex++;

        moveSlider(true);
    }


    /* =========================================
       PREVIOUS REVIEW
    ========================================= */

    function showPreviousReview() {

        if (
            allReviews.length <= reviewsPerView ||
            isAnimating
        ) {
            return;
        }

        isAnimating = true;

        currentIndex--;

        moveSlider(true);
    }


    /* =========================================
       HANDLE INFINITE LOOP
    ========================================= */

    track?.addEventListener(
        "transitionend",
        () => {

            if (
                allReviews.length <=
                reviewsPerView
            ) {
                isAnimating = false;
                return;
            }


            /*
                We reached the cloned reviews
                at the end.
            */

            if (
                currentIndex >=
                allReviews.length +
                reviewsPerView
            ) {

                currentIndex =
                    reviewsPerView;

                moveSlider(false);
            }


            /*
                We reached the cloned reviews
                at the beginning.
            */

            if (
                currentIndex < reviewsPerView
            ) {

                currentIndex =
                    allReviews.length +
                    currentIndex;

                moveSlider(false);
            }

            isAnimating = false;
        }
    );


    /* =========================================
       BUTTON EVENTS
    ========================================= */

    nextBtn?.addEventListener(
        "click",
        () => {

            showNextReview();

            restartAutoSlide();
        }
    );


    prevBtn?.addEventListener(
        "click",
        () => {

            showPreviousReview();

            restartAutoSlide();
        }
    );


    /* =========================================
       AUTO SLIDE
    ========================================= */

    function startAutoSlide() {

        stopAutoSlide();

        if (
            allReviews.length <=
            reviewsPerView
        ) {
            return;
        }

        autoSlideTimer =
            setInterval(() => {

                showNextReview();

            }, 4000);
    }


    function stopAutoSlide() {

        if (autoSlideTimer) {

            clearInterval(
                autoSlideTimer
            );

            autoSlideTimer = null;
        }
    }


    function restartAutoSlide() {

        stopAutoSlide();

        startAutoSlide();
    }


    /* =========================================
       PAUSE AUTO SLIDE ON HOVER
    ========================================= */

    list?.addEventListener(
        "mouseenter",
        stopAutoSlide
    );

    list?.addEventListener(
        "mouseleave",
        startAutoSlide
    );


    /* =========================================
       TOUCH / SWIPE
    ========================================= */

    let touchStartX = 0;

    let touchEndX = 0;


    list?.addEventListener(
        "touchstart",
        (event) => {

            touchStartX =
                event.changedTouches[0].screenX;

            stopAutoSlide();
        },
        { passive: true }
    );


    list?.addEventListener(
        "touchend",
        (event) => {

            touchEndX =
                event.changedTouches[0].screenX;

            handleSwipe();

            startAutoSlide();
        },
        { passive: true }
    );


    function handleSwipe() {

        const difference =
            touchStartX - touchEndX;


        /* Swipe left */

        if (difference > 50) {

            showNextReview();

        }


        /* Swipe right */

        if (difference < -50) {

            showPreviousReview();

        }
    }


    /* =========================================
       WINDOW RESIZE
    ========================================= */

    let resizeTimer;

    window.addEventListener(
        "resize",
        () => {

            clearTimeout(
                resizeTimer
            );

            resizeTimer =
                setTimeout(() => {

                    buildSlider();

                    startAutoSlide();

                }, 250);
        }
    );


    /* =========================================
       REVIEW MODAL
    ========================================= */

    function openModal() {

        if (!modal) return;

        modal.classList.add("active");

        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.style.overflow =
            "hidden";
    }


    function closeModal() {

        if (!modal) return;

        modal.classList.remove("active");

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

    stars.forEach((star) => {

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


                stars.forEach((s) => {

                    const starRating =
                        Number(
                            s.dataset.rating
                        );

                    s.classList.toggle(
                        "active",
                        starRating <= rating
                    );
                });
            }
        );
    });


    /* =========================================
       LOAD REVIEWS FROM SUPABASE
    ========================================= */

    async function loadReviews() {

        console.log(
            "Loading reviews..."
        );


        const {
            data,
            error
        } = await window.supabaseClient
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


        updateSummary(
            allReviews
        );


        buildSlider();


        startAutoSlide();
    }


    /* =========================================
       SUBMIT REVIEW
    ========================================= */

    form?.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const name =
                nameInput?.value.trim() || "";


            const review =
                textInput?.value.trim() || "";


            const rating =
                Number(
                    ratingInput?.value
                );


            /* Validate name */

            if (name.length < 2) {

                setMessage(
                    "Please enter your name.",
                    true
                );

                return;
            }


            /* Validate rating */

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


            /* Validate review */

            if (review.length < 5) {

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
                    ratingInput.value = 0;
                }


                stars.forEach((star) => {

                    star.classList.remove(
                        "active"
                    );
                });


                setTimeout(() => {

                    closeModal();

                    if (message) {
                        message.textContent =
                            "";
                    }

                }, 2500);
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
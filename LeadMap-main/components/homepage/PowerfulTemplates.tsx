'use client'

import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'
import Slider from 'react-slick'
import Image from 'next/image'
import { useRef } from 'react'

export const PowerfulTemplates = () => {
  const sliderRef = useRef<Slider | null>(null)

  const settings = {
    className: 'center',
    centerMode: true,
    infinite: true,
    draggable: true,
    centerPadding: '60px',
    slidesToShow: 3,
    autoplay: true,
    speed: 6000,
    arrows: false,
    autoplaySpeed: 6000,
    cssEase: 'linear',
    responsive: [
      { breakpoint: 1024, settings: { slidesToShow: 3, slidesToScroll: 3 } },
      { breakpoint: 600, settings: { slidesToShow: 2, slidesToScroll: 2, initialSlide: 2 } },
      { breakpoint: 480, settings: { slidesToShow: 1, slidesToScroll: 1 } },
    ],
  }

  return (
    <section>
      <div className="container px-4 pb-0 lg:pt-24 pt-12">
        <div className="wrapper py-[72px] bg-lightprimary dark:bg-lightprimary rounded-xl">
          <div className="grid grid-cols-12 mb-14">
            <div className="lg:col-span-6 col-span-12">
              <h2 className="px-6 sm:px-16 font-bold text-link dark:text-white leading-tight text-2xl sm:text-3xl md:text-40">
                Maps, campaigns, and pipelines in one platform
              </h2>
            </div>
          </div>
          <div className="slider-container">
            <Slider ref={sliderRef} {...settings}>
              <div className="px-3 pb-10 focus:outline-0">
                <Image
                  src="/images/landingpage/demos/demo-dark.png"
                  alt="demos"
                  width={480}
                  height={320}
                  className="max-w-full w-full rounded-md custom-shadow"
                />
              </div>
              <div className="px-3 pb-10 focus:outline-0">
                <Image
                  src="/images/landingpage/demos/demo-horizontal.png"
                  alt="demos"
                  width={480}
                  height={320}
                  className="max-w-full w-full rounded-md custom-shadow"
                />
              </div>
              <div className="px-3 pb-10 focus:outline-0">
                <Image
                  src="/images/landingpage/demos/demo-dark.png"
                  alt="demos"
                  width={480}
                  height={320}
                  className="max-w-full w-full rounded-md custom-shadow"
                />
              </div>
              <div className="px-3 pb-10 focus:outline-0">
                <Image
                  src="/images/landingpage/demos/demo-main.png"
                  alt="demos"
                  width={480}
                  height={320}
                  className="max-w-full w-full rounded-md custom-shadow"
                />
              </div>
              <div className="px-3 pb-10 focus:outline-0">
                <Image
                  src="/images/landingpage/demos/demo-mini.png"
                  alt="demos"
                  width={480}
                  height={320}
                  className="max-w-full w-full rounded-md custom-shadow"
                />
              </div>
              <div className="px-3 pb-10 focus:outline-0">
                <Image
                  src="/images/landingpage/demos/demo-rtl.png"
                  alt="demos"
                  width={480}
                  height={320}
                  className="max-w-full w-full rounded-md custom-shadow"
                />
              </div>
            </Slider>
          </div>
          <div className="mt-8">
            <div className="container-md">
              <div className="grid grid-cols-12 gap-6 text-center">
                <div className="lg:col-span-4 col-span-12">
                  <h3 className="text-lg text-link dark:text-white font-bold mb-4">
                    Interactive Maps
                  </h3>
                  <p className="text-sm text-lightmuted dark:text-darklink leading-loose px-4">
                    Find and visualize leads on the map. Filter by property type, location, and market indicators for precise targeting.
                  </p>
                </div>
                <div className="lg:col-span-4 col-span-12">
                  <h3 className="text-lg text-link dark:text-white font-bold mb-4">
                    AI Assistant & Enrichment
                  </h3>
                  <p className="text-sm text-lightmuted dark:text-darklink leading-loose px-4">
                    Enrich property and owner data automatically. Use AI to qualify leads and prioritize your pipeline.
                  </p>
                </div>
                <div className="lg:col-span-4 col-span-12">
                  <h3 className="text-lg text-link dark:text-white font-bold mb-4">
                    Campaigns & Follow-ups
                  </h3>
                  <p className="text-sm text-lightmuted dark:text-darklink leading-loose px-4">
                    Run outreach campaigns and automated follow-ups. Keep every deal moving with workflows that scale.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

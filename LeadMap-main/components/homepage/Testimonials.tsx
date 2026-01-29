'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import 'swiper/css/pagination'
import type { Swiper as SwiperClass } from 'swiper/types'
import { Icon } from '@iconify/react/dist/iconify.js'

export const Testimonials = () => {
  const Customers = [
    {
      key: 'leader1',
      img: '/images/profile/user-1.jpg',
      name: 'Tanza James',
      desc: 'Every agent is more productive with NextDeal. We closed 75% more deals while cutting prospecting time in half.',
    },
    {
      key: 'leader2',
      img: '/images/profile/user-2.jpg',
      name: 'Alex Martinez',
      desc: 'The platform is clean and intuitive. We found higher-quality leads and our pipeline has never been stronger.',
    },
    {
      key: 'leader3',
      img: '/images/profile/user-3.jpg',
      name: 'Sarah Chen',
      desc: 'NextDeal\'s AI and data enrichment saved us hours every week. ROI showed up within the first month.',
    },
    {
      key: 'leader4',
      img: '/images/profile/user-1.jpg',
      name: 'Tanza James',
      desc: 'Every agent is more productive with NextDeal. We closed 75% more deals while cutting prospecting time in half.',
    },
  ]
  const swiperRef = useRef<SwiperClass | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const activeDir = 'ltr'

  return (
    <section>
      <div className="container-md lg:py-24 py-12 px-4">
        <div className="grid grid-cols-12 gap-6">
          <div className="lg:col-span-6 col-span-12 flex items-center">
            <div className="flex w-full  text-center sm:text-left">
              <div className="lg:w-9/12 w-full">
                <h4 className="text-2xl sm:text-3xl md:text-40 leading-tight text-link font-bold dark:text-white mb-4 pe-10">
                  What real estate professionals say about NextDeal
                </h4>
                <p className="text-base text-lightmuted dark:text-darklink leading-relaxed">
                  Join over 1,000 agents and teams who use NextDeal to find leads, enrich data, and close more deals.
                </p>
              </div>
            </div>
          </div>
          <div className="lg:col-span-6 col-span-12">
            <div className="rounded-2xl border border-border dark:border-darkborder p-8 sm:p-12">
              <h5 className="text-2xl font-semibold text-link dark:text-white mb-8">
                Customer stories
              </h5>
              <div>
                <Swiper
                  onSwiper={(swiper: SwiperClass) => {
                    swiperRef.current = swiper
                  }}
                  onSlideChange={(swiper: SwiperClass) => {
                    setCurrentIndex(swiper.activeIndex)
                  }}
                  slidesPerView={1}
                  spaceBetween={30}
                  className="mySwiper"
                >
                  {Customers.map((item) => (
                    <SwiperSlide key={item.key}>
                      <div className="img-wrapper pb-6 border-b border-border dark:border-darkborder">
                        <div className="flex items-center gap-4 mb-6">
                          <Image
                            src={item.img}
                            alt="leader-image"
                            width={56}
                            height={56}
                            className="h-14 w-14 rounded-full"
                          />
                          <h5 className="text-base font-bold text-link dark:text-white">
                            {item.name}
                          </h5>
                        </div>
                        <p className="text-lg text-lightmuted dark:text-darklink">
                          {item.desc}
                        </p>
                      </div>
                    </SwiperSlide>
                  ))}
                </Swiper>
                <div className="flex items-center gap-2 mt-6">
                  <div
                    onClick={() => swiperRef.current?.slidePrev()}
                    className={`h-8 w-8 rounded-full flex items-center justify-center bg-lightprimary text-link dark:text-darklink dark:bg-dark ${
                      currentIndex === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                    }`}
                  >
                    <Icon
                      icon={activeDir === 'ltr' ? 'tabler:chevron-left' : 'tabler:chevron-right'}
                      className="shrink-0 text-xl"
                    />
                  </div>
                  <p className="text-base text-lightmuted dark:text-darklink">
                    {currentIndex + 1}/{Customers.length}
                  </p>
                  <div
                    onClick={() => swiperRef.current?.slideNext()}
                    className={`h-8 w-8 rounded-full flex items-center justify-center bg-lightprimary text-link dark:text-darklink dark:bg-dark  ${
                      currentIndex === Customers.length - 1
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    } `}
                  >
                    <Icon
                      icon={activeDir === 'ltr' ? 'tabler:chevron-right' : 'tabler:chevron-left'}
                      className="shrink-0 text-xl"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

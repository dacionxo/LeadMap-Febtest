'use client'

import Image from 'next/image'
import { Icon } from '@iconify/react/dist/iconify.js'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion'

export const TeamWorks = () => {
  const [workType, setWorkType] = useState('Team Scheduling')

  const WorkTypes = [
    { key: 'work1', work: 'Team Scheduling', icon: 'tabler:user-circle', isBorder: true },
    { key: 'work2', work: 'Payments', icon: 'tabler:credit-card-pay', isBorder: true },
    { key: 'work3', work: 'Embedding', icon: 'tabler:layout-sidebar-right', isBorder: true },
    { key: 'work4', work: 'Workflows', icon: 'tabler:topology-star-3', isBorder: false },
  ]

  const accordionContent = (
    <>
      <AccordionItem value="item-1">
        <AccordionTrigger className="text-base font-semibold">
          Combine teammate schedules
        </AccordionTrigger>
        <AccordionContent>
          Factor in availability for required attendees, and skip checking for
          conflicts for optional attendees.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger className="text-base font-semibold">
          Factor in outside colleagues
        </AccordionTrigger>
        <AccordionContent>
          Factor in availability for required attendees, and skip checking for
          conflicts for optional attendees.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger className="text-base font-semibold">
          Round robin pooling
        </AccordionTrigger>
        <AccordionContent>
          Factor in availability for required attendees, and skip checking for
          conflicts for optional attendees.
        </AccordionContent>
      </AccordionItem>
    </>
  )

  return (
    <section>
      <div className="w-full border-t border-border dark:border-darkborder mb-16 custom-shadow mt-0">
        <div className="container-md">
          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 min-w-[350px] sm:min-w-[900px]">
              {WorkTypes.map((item) => (
                <div className="col-span-3" key={item.key}>
                  <div
                    onClick={() => setWorkType(item.work)}
                    className={`cursor-pointer py-7 px-4 flex justify-center ${
                      workType === item.work
                        ? 'text-primary border-t-2 border-t-primary dark:border-t-primary'
                        : ''
                    } ${
                      item.isBorder
                        ? 'justify-center border-r border-r-border dark:border-r-darkborder'
                        : ''
                    }`}
                  >
                    <div className="flex gap-2 items-center">
                      <Icon icon={item.icon} className="shrink-0 text-2xl" />
                      <h3
                        className={`hidden sm:block text-lg font-semibold ${
                          workType === item.work ? 'text-primary dark:text-primary' : ''
                        }`}
                      >
                        {item.work}
                      </h3>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="container-md px-4">
        <div className="grid grid-cols-12 gap-6">
          <div className="lg:col-span-6 col-span-12">
            <Image
              src="/images/frontend-pages/background/feature-bg.jpg"
              alt="feature-img"
              width={600}
              height={400}
            />
          </div>
          <div className="lg:col-span-6 col-span-12 flex items-center">
            <div className="flex flex-col ps-0 lg:ps-10 items-start w-full">
              <h2 className="mb-6 text-3xl md:text-40 leading-normal text-link dark:text-white font-bold">
                {workType === 'Team Scheduling'
                  ? 'Defend your focus'
                  : workType === 'Payments'
                    ? 'Campaigns & outreach'
                    : workType === 'Embedding'
                      ? 'Maps & CRM'
                      : 'NextDeal workflows'}
              </h2>
              <Accordion type="single" collapsible className="w-full">
                {accordionContent}
              </Accordion>
              <Button className="mt-6" asChild>
                <Link href="/dashboard">Learn More</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

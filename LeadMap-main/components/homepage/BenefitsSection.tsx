export const BenefitsSection = () => {
  const benefits = [
    {
      key: 'b1',
      value: '75%',
      label: 'increase in closed deals',
    },
    {
      key: 'b2',
      value: '2X',
      label: 'agent efficiency',
    },
    {
      key: 'b3',
      value: '50%',
      label: 'lower prospecting costs',
    },
  ]
  const stats = [
    { key: 's1', value: '97%', label: 'Customer Satisfaction' },
    { key: 's2', value: '3x', label: 'Faster Deal Flow' },
    { key: 's3', value: '$10M+', label: 'In Closed Deals' },
  ]
  return (
    <section className="bg-lightprimary dark:bg-lightprimary">
      <div className="container px-4 py-12 lg:py-16">
        <div className="flex justify-center w-full mb-10">
          <p className="text-base md:text-lg text-lightmuted dark:text-darklink text-center max-w-2xl">
            Join over 1,000 real estate professionals using LeadMap
          </p>
        </div>
        <div className="grid grid-cols-1 tablet:grid-cols-3 gap-6 mb-12">
          {benefits.map((b) => (
            <div
              key={b.key}
              className="flex flex-col justify-between rounded-2xl bg-white dark:bg-dark p-6 lg:p-8 min-h-[140px] shadow-sm border border-border dark:border-darkborder"
            >
              <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary tracking-tight">
                {b.value}
              </h3>
              <p className="text-base text-lightmuted dark:text-darklink mt-2">
                {b.label}
              </p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 tablet:grid-cols-3 gap-6">
          {stats.map((s) => (
            <div
              key={s.key}
              className="flex flex-col items-center tablet:items-start"
            >
              <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-primary mb-1">
                {s.value}
              </h3>
              <p className="text-base text-lightmuted dark:text-darklink">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

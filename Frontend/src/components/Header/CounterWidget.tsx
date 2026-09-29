import React from 'react';

interface CounterWidgetProps {
  label: string;
  value: string | number;
  isPass?: boolean;
  isFail?: boolean;
}

const CounterWidget: React.FC<CounterWidgetProps> = ({ label, value, isPass, isFail }) => {
  let labelColor = 'text-pixtron-blue';
  if (isPass) labelColor = 'text-pixtron-green';
  if (isFail) labelColor = 'text-pixtron-red';

  return (
    <div className="flex flex-col items-center justify-center w-full min-w-[60px]">
      <div className={`font-bold text-[11px] mb-1 tracking-wider ${labelColor}`}>{label}</div>
      <div className="bg-[#0e2c70] text-white rounded-[4px] w-full py-1 text-center font-bold text-xl shadow-md border-b-2 border-[#091f52]">
        {value}
      </div>
    </div>
  );
};

export default CounterWidget;

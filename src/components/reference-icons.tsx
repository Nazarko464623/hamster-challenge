import Svg, { Circle, Path } from 'react-native-svg';

export type ReferenceIconName = 'trophy' | 'home' | 'messenger' | 'account';

export function ReferenceIcon({ name, active = false }: { name: ReferenceIconName; active?: boolean }) {
  const stroke = active ? '#FF7417' : '#9F9F9F';
  const fill = active ? '#FFD6B8' : '#363636';
  const size = active ? 44 : 38;

  if (name === 'trophy') {
    return (
      <Svg width={size} height={size} viewBox="0 0 38 38">
        <Path
          d="M9.5 1.35718V16.2857C9.5 18.8053 10.5009 21.2217 12.2825 23.0033C14.0641 24.7849 16.4804 25.7857 19 25.7857C21.5196 25.7857 23.9359 24.7849 25.7175 23.0033C27.4991 21.2217 28.5 18.8053 28.5 16.2857V1.35718H9.5Z"
          fill={active ? '#FFD6B8' : '#363636'}
        />
        <Path
          d="M19 25.7857V36.6429M19 36.6429H9.50003M19 36.6429H28.5M9.50003 1.35718H1.35718V9.50003C1.35718 11.6597 2.21508 13.7308 3.74217 15.2579C5.26925 16.785 7.34041 17.6429 9.50003 17.6429V1.35718ZM28.5 1.35718H36.6429V9.50003C36.6429 11.6597 35.785 13.7308 34.2579 15.2579C32.7308 16.785 30.6597 17.6429 28.5 17.6429V1.35718Z"
          stroke={stroke}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M9.5 1.35718V16.2857C9.5 18.8053 10.5009 21.2217 12.2825 23.0033C14.0641 24.7849 16.4804 25.7857 19 25.7857C21.5196 25.7857 23.9359 24.7849 25.7175 23.0033C27.4991 21.2217 28.5 18.8053 28.5 16.2857V1.35718H9.5Z"
          stroke={stroke}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (name === 'home') {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path
          d="m5.5 21.5 15.1-13.4a5 5 0 0 1 6.8 0l15.1 13.4v13a5 5 0 0 1-5 5h-27a5 5 0 0 1-5-5v-13Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        <Path
          d="M18 39V28a6 6 0 0 1 12 0v11"
          fill={active ? '#FFD6B8' : '#363636'}
          stroke={stroke}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (name === 'messenger') {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path
          d="M8 11a7 7 0 0 1 7-7h16a7 7 0 0 1 7 7v12a7 7 0 0 1-7 7H20l-9 7 2-9a7 7 0 0 1-5-6V11Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        <Circle
          cx={37}
          cy={10}
          r={6}
          fill={active ? '#FFD6B8' : '#363636'}
          stroke={stroke}
          strokeWidth={2.5}
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle
        cx={24}
        cy={24}
        r={18}
        fill={fill}
        stroke={stroke}
        strokeWidth={2.5}
      />
      <Circle
        cx={24}
        cy={18}
        r={6}
        fill={active ? '#FFD6B8' : '#363636'}
        stroke={stroke}
        strokeWidth={2.5}
      />
      <Path
        d="M13 37c.8-6 5-9 11-9s10.2 3 11 9"
        fill={active ? '#FFD6B8' : '#363636'}
        stroke={stroke}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

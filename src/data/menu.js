/**
 * Static weekly menu data (JSON-like config consumed by the React UI).
 * Fixed weekly rotation: index 0 = Monday … 6 = Sunday
 */
export const WEEKLY_MENU = [
  {
    day: 'Monday',
    breakfast: {
      south: 'Idli + Sambar + Coconut Chutney',
      north: 'Aloo Paratha + Curd + Pickle',
    },
    lunch: {
      south: 'Sambar Rice + Beetroot Poriyal + Papad + Buttermilk',
      north: 'Rajma Chawal + Jeera Aloo + Salad',
    },
    snacks: {
      south: 'Masala Vada + Coffee',
      north: 'Bread Pakora + Chai',
    },
    dinner: {
      south: 'Rice + Dal Tadka + Beans Poriyal + Pickle',
      north: 'Chole + Bhatura + Onion Salad',
    },
  },
  {
    day: 'Tuesday',
    breakfast: {
      south: 'Pongal + Sambar + Chutney',
      north: 'Poha + Sev + Lemon',
    },
    lunch: {
      south: 'Curd Rice + Kara Kuzhambu + Beans Poriyal',
      north: 'Kadhi Pakora + Steamed Rice + Papad',
    },
    snacks: {
      south: 'Bonda + Filter Coffee',
      north: 'Samosa + Mint Chutney',
    },
    dinner: {
      south: 'Chapati + Mixed Veg Kurma + Rasam',
      north: 'Paneer Butter Masala + Naan + Salad',
    },
  },
  {
    day: 'Wednesday',
    breakfast: {
      south: 'Set Dosa + Sambar + Tomato Chutney',
      north: 'Chole Bhature (mini) + Pickle',
    },
    lunch: {
      south: 'Lemon Rice + Vathal Kuzhambu + Cabbage Poriyal',
      north: 'Dal Makhani + Jeera Rice + Cucumber Raita',
    },
    snacks: {
      south: 'Medu Vada + Chutney',
      north: 'Spring Roll + Tangy Dip',
    },
    dinner: {
      south: 'Rice + Sambhar + Potato Fry + Curd',
      north: 'Mixed Veg Pulao + Boondi Raita + Pickle',
    },
  },
  {
    day: 'Thursday',
    breakfast: {
      south: 'Upma + Coconut Chutney',
      north: 'Stuffed Paratha + Curd',
    },
    lunch: {
      south: 'Meals — Rice + Sambar + Rasam + Poriyal + Appalam',
      north: 'Chana Masala + Poori + Pickle + Raita',
    },
    snacks: {
      south: 'Banana Bajji + Tea',
      north: 'Patra + Chai',
    },
    dinner: {
      south: 'Parotta + Veg Salna + Onions',
      north: 'Malai Kofta + Roti + Salad',
    },
  },
  {
    day: 'Friday',
    breakfast: {
      south: 'Rava Idli + Sambar + Chutney',
      north: 'Besan Chilla + Green Chutney',
    },
    lunch: {
      south: 'Tomato Rice + Aviyal + Stir Fry',
      north: 'Veg Biryani + Raita + Mirchi Salan',
    },
    snacks: {
      south: 'Sundal + Coffee',
      north: 'Dhokla + Chutney',
    },
    dinner: {
      south: 'Rice + Kara Kuzhambu + Okra Poriyal',
      north: 'Dal Tadka + Rice + Gobi Sabzi',
    },
  },
  {
    day: 'Saturday',
    breakfast: {
      south: 'Uttapam + Sambar + Chutney',
      north: 'Methi Paratha + Pickle + Curd',
    },
    lunch: {
      south: 'Sambar Rice + Keerai Poriyal + Curd',
      north: 'Stuffed Capsicum + Paratha + Salad',
    },
    snacks: {
      south: 'Mysore Bonda + Tea',
      north: 'Kachori + Chutney',
    },
    dinner: {
      south: 'Curd Rice + Lemon Pickle + Poriyal',
      north: 'Matar Paneer + Roti + Butter',
    },
  },
  {
    day: 'Sunday',
    breakfast: {
      south: 'Poori + Potato Masala + Chutney',
      north: 'Halwa + Chole + Bhature',
    },
    lunch: {
      south: 'Special Meals — Payasam + Variety Rice',
      north: 'Punjabi Thali (Dal + Sabzi + Roti + Sweet)',
    },
    snacks: {
      south: 'Kesari + Coffee',
      north: 'Jalebi + Rabri (small portion)',
    },
    dinner: {
      south: 'Rice + Sambar + Beans Poriyal + Fryums',
      north: 'Palak Paneer + Garlic Naan + Salad',
    },
  },
]

/** Monday = 0 … Sunday = 6 */
export function menuForDate(d = new Date()) {
  const jsDay = d.getDay() // 0 Sun … 6 Sat
  const mondayIndex = jsDay === 0 ? 6 : jsDay - 1
  return WEEKLY_MENU[mondayIndex]
}

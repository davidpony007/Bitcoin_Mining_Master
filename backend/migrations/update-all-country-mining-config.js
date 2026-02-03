/**
 * 更新完整的国家挖矿配置表数据
 * 
 * 功能说明:
 * - 根据提供的国家列表，批量插入/更新所有国家的挖矿速率配置
 * - 包含全球200+个国家和地区
 * 
 * 执行方式:
 * node migrations/update-all-country-mining-config.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// 完整的国家挖矿倍率配置数据（根据用户提供的表格）
const countryConfigs = [
  // 26倍速率国家
  { country_code: 'AU', country_name: 'Australia', country_name_cn: '澳大利亚', mining_multiplier: 26 },
  { country_code: 'US', country_name: 'United States', country_name_cn: '美国', mining_multiplier: 26 },
  { country_code: 'CA', country_name: 'Canada', country_name_cn: '加拿大', mining_multiplier: 26 },
  
  // 18倍速率国家
  { country_code: 'NZ', country_name: 'New Zealand', country_name_cn: '新西兰', mining_multiplier: 18 },
  { country_code: 'DK', country_name: 'Denmark', country_name_cn: '丹麦', mining_multiplier: 18 },
  { country_code: 'CH', country_name: 'Switzerland', country_name_cn: '瑞士', mining_multiplier: 18 },
  { country_code: 'DE', country_name: 'Germany', country_name_cn: '德国', mining_multiplier: 18 },
  { country_code: 'UK', country_name: 'United Kingdom', country_name_cn: '英国', mining_multiplier: 18 },
  { country_code: 'AT', country_name: 'Austria', country_name_cn: '奥地利', mining_multiplier: 18 },
  { country_code: 'BE', country_name: 'Belgium', country_name_cn: '比利时', mining_multiplier: 18 },
  { country_code: 'FR', country_name: 'France', country_name_cn: '法国', mining_multiplier: 18 },
  
  // 15倍速率国家
  { country_code: 'IS', country_name: 'Iceland', country_name_cn: '冰岛', mining_multiplier: 15 },
  { country_code: 'JP', country_name: 'Japan', country_name_cn: '日本', mining_multiplier: 15 },
  { country_code: 'LU', country_name: 'Luxembourg', country_name_cn: '卢森堡', mining_multiplier: 15 },
  { country_code: 'IL', country_name: 'Israel', country_name_cn: '以色列', mining_multiplier: 15 },
  { country_code: 'ES', country_name: 'Spain', country_name_cn: '西班牙', mining_multiplier: 15 },
  { country_code: 'EE', country_name: 'Estonia', country_name_cn: '爱沙尼亚', mining_multiplier: 15 },
  { country_code: 'SE', country_name: 'Sweden', country_name_cn: '瑞典', mining_multiplier: 15 },
  { country_code: 'IT', country_name: 'Italy', country_name_cn: '意大利', mining_multiplier: 15 },
  { country_code: 'MX', country_name: 'Mexico', country_name_cn: '墨西哥', mining_multiplier: 15 },
  { country_code: 'NL', country_name: 'Netherlands', country_name_cn: '荷兰', mining_multiplier: 15 },
  { country_code: 'CZ', country_name: 'Czech Republic', country_name_cn: '捷克共和国', mining_multiplier: 15 },
  { country_code: 'PL', country_name: 'Poland', country_name_cn: '波兰', mining_multiplier: 15 },
  { country_code: 'TW', country_name: 'Taiwan', country_name_cn: '中国台湾', mining_multiplier: 15 },
  { country_code: 'NO', country_name: 'Norway', country_name_cn: '挪威', mining_multiplier: 15 },
  { country_code: 'AE', country_name: 'United Arab Emirates', country_name_cn: '阿拉伯联合酋长国', mining_multiplier: 15 },
  
  // 10倍速率国家
  { country_code: 'PR', country_name: 'Puerto Rico', country_name_cn: '波多黎各', mining_multiplier: 10 },
  { country_code: 'DM', country_name: 'Dominica', country_name_cn: '多米尼克', mining_multiplier: 10 },
  { country_code: 'LV', country_name: 'Latvia', country_name_cn: '拉脱维亚', mining_multiplier: 10 },
  { country_code: 'SI', country_name: 'Slovenia', country_name_cn: '斯洛文尼亚', mining_multiplier: 10 },
  { country_code: 'HR', country_name: 'Croatia', country_name_cn: '克罗地亚', mining_multiplier: 10 },
  { country_code: 'IE', country_name: 'Ireland', country_name_cn: '爱尔兰', mining_multiplier: 10 },
  { country_code: 'KG', country_name: 'Kyrgyzstan', country_name_cn: '吉尔吉斯斯坦', mining_multiplier: 10 },
  { country_code: 'LT', country_name: 'Lithuania', country_name_cn: '立陶宛', mining_multiplier: 10 },
  { country_code: 'CL', country_name: 'Chile', country_name_cn: '智利', mining_multiplier: 10 },
  { country_code: 'MU', country_name: 'Mauritius', country_name_cn: '毛里求斯', mining_multiplier: 10 },
  { country_code: 'PT', country_name: 'Portugal', country_name_cn: '葡萄牙', mining_multiplier: 10 },
  
  // 8倍速率国家
  { country_code: 'UY', country_name: 'Uruguay', country_name_cn: '乌拉圭', mining_multiplier: 8 },
  { country_code: 'TR', country_name: 'Turkey', country_name_cn: '土耳其', mining_multiplier: 8 },
  { country_code: 'SK', country_name: 'Slovakia', country_name_cn: '斯洛伐克', mining_multiplier: 8 },
  { country_code: 'BY', country_name: 'Belarus', country_name_cn: '白俄罗斯', mining_multiplier: 8 },
  { country_code: 'KW', country_name: 'Kuwait', country_name_cn: '科威特', mining_multiplier: 8 },
  { country_code: 'BH', country_name: 'Bahrain', country_name_cn: '巴林', mining_multiplier: 8 },
  { country_code: 'BR', country_name: 'Brazil', country_name_cn: '巴西', mining_multiplier: 8 },
  { country_code: 'JM', country_name: 'Jamaica', country_name_cn: '牙买加', mining_multiplier: 8 },
  { country_code: 'RO', country_name: 'Romania', country_name_cn: '罗马尼亚', mining_multiplier: 8 },
  { country_code: 'HU', country_name: 'Hungary', country_name_cn: '匈牙利', mining_multiplier: 8 },
  { country_code: 'SA', country_name: 'Saudi Arabia', country_name_cn: '沙特阿拉伯', mining_multiplier: 8 },
  { country_code: 'AR', country_name: 'Argentina', country_name_cn: '阿根廷', mining_multiplier: 8 },
  { country_code: 'SG', country_name: 'Singapore', country_name_cn: '新加坡', mining_multiplier: 8 },
  
  // 5倍速率国家
  { country_code: 'CO', country_name: 'Colombia', country_name_cn: '哥伦比亚', mining_multiplier: 5 },
  { country_code: 'QA', country_name: 'Qatar', country_name_cn: '卡塔尔', mining_multiplier: 5 },
  { country_code: 'EC', country_name: 'Ecuador', country_name_cn: '厄瓜多尔', mining_multiplier: 5 },
  { country_code: 'GQ', country_name: 'Equatorial Guinea', country_name_cn: '赤道几内亚', mining_multiplier: 5 },
  { country_code: 'TH', country_name: 'Thailand', country_name_cn: '泰国', mining_multiplier: 5 },
  { country_code: 'UA', country_name: 'Ukraine', country_name_cn: '乌克兰', mining_multiplier: 5 },
  { country_code: 'PA', country_name: 'Panama', country_name_cn: '巴拿马', mining_multiplier: 5 },
  { country_code: 'PH', country_name: 'Philippines', country_name_cn: '菲律宾', mining_multiplier: 5 },
  { country_code: 'PE', country_name: 'Peru', country_name_cn: '秘鲁', mining_multiplier: 5 },
  { country_code: 'ZA', country_name: 'South Africa', country_name_cn: '南非', mining_multiplier: 5 },
  { country_code: 'FI', country_name: 'Finland', country_name_cn: '芬兰', mining_multiplier: 5 },
  { country_code: 'TJ', country_name: 'Tajikistan', country_name_cn: '塔吉克斯坦', mining_multiplier: 5 },
  { country_code: 'HK', country_name: 'Hong Kong', country_name_cn: '香港', mining_multiplier: 5 },
  
  // 4倍速率国家
  { country_code: 'BG', country_name: 'Bulgaria', country_name_cn: '保加利亚', mining_multiplier: 4 },
  { country_code: 'MV', country_name: 'Maldives', country_name_cn: '马尔代夫', mining_multiplier: 4 },
  { country_code: 'GR', country_name: 'Greece', country_name_cn: '希腊', mining_multiplier: 4 },
  { country_code: 'HN', country_name: 'Honduras', country_name_cn: '洪都拉斯', mining_multiplier: 4 },
  { country_code: 'KZ', country_name: 'Kazakhstan', country_name_cn: '哈萨克斯坦', mining_multiplier: 4 },
  { country_code: 'CR', country_name: 'Costa Rica', country_name_cn: '哥斯达黎加', mining_multiplier: 4 },
  { country_code: 'MZ', country_name: 'Mozambique', country_name_cn: '莫桑比克', mining_multiplier: 4 },
  { country_code: 'MY', country_name: 'Malaysia', country_name_cn: '马来西亚', mining_multiplier: 4 },
  { country_code: 'OM', country_name: 'Oman', country_name_cn: '阿曼', mining_multiplier: 4 },
  { country_code: 'RS', country_name: 'Serbia', country_name_cn: '塞尔维亚', mining_multiplier: 4 },
  { country_code: 'UZ', country_name: 'Uzbekistan', country_name_cn: '乌兹别克斯坦', mining_multiplier: 4 },
  { country_code: 'MO', country_name: 'Macao', country_name_cn: 'Macao', mining_multiplier: 4 },
  
  // 3倍速率国家
  { country_code: 'MC', country_name: 'Monaco', country_name_cn: '摩纳哥', mining_multiplier: 3 },
  { country_code: 'BS', country_name: 'Bahamas', country_name_cn: '巴哈马', mining_multiplier: 3 },
  { country_code: 'BM', country_name: 'Bermuda', country_name_cn: '百慕大', mining_multiplier: 3 },
  { country_code: 'IM', country_name: 'Isle of Man', country_name_cn: '马恩岛', mining_multiplier: 3 },
  { country_code: 'GG', country_name: 'Guernsey', country_name_cn: '根西岛', mining_multiplier: 3 },
  { country_code: 'JE', country_name: 'Jersey', country_name_cn: '泽西岛', mining_multiplier: 3 },
  { country_code: 'BQ', country_name: 'Bonaire, Sint Eustatius', country_name_cn: '博内尔圣尤斯特歇斯和萨巴', mining_multiplier: 3 },
  { country_code: 'NC', country_name: 'New Caledonia', country_name_cn: '新喀里多尼亚', mining_multiplier: 3 },
  { country_code: 'GL', country_name: 'Greenland', country_name_cn: '格陵兰', mining_multiplier: 3 },
  { country_code: 'KM', country_name: 'Comoros', country_name_cn: '科摩罗', mining_multiplier: 3 },
  { country_code: 'KN', country_name: 'Saint Kitts and Nevis', country_name_cn: '圣基茨和尼维斯', mining_multiplier: 3 },
  { country_code: 'MQ', country_name: 'Martinique', country_name_cn: '马提尼克岛', mining_multiplier: 3 },
  { country_code: 'VI', country_name: 'Virgin Islands, U.S.', country_name_cn: '美属维尔京群岛', mining_multiplier: 3 },
  { country_code: 'CY', country_name: 'Cyprus', country_name_cn: '塞浦路斯', mining_multiplier: 3 },
  
  // 2倍速率国家
  { country_code: 'CW', country_name: 'Curacao', country_name_cn: '库拉索岛', mining_multiplier: 2 },
  { country_code: 'GI', country_name: 'Gibraltar', country_name_cn: '直布罗陀', mining_multiplier: 2 },
  { country_code: 'GF', country_name: 'French Guiana', country_name_cn: '法属圭亚那', mining_multiplier: 2 },
  { country_code: 'YT', country_name: 'Mayotte', country_name_cn: '马约特岛', mining_multiplier: 2 },
  { country_code: 'FJ', country_name: 'Fiji', country_name_cn: '斐济', mining_multiplier: 2 },
  { country_code: 'GP', country_name: 'Guadeloupe', country_name_cn: '瓜德罗普岛', mining_multiplier: 2 },
  { country_code: 'PF', country_name: 'French Polynesia', country_name_cn: '法属波利尼西亚', mining_multiplier: 2 },
  { country_code: 'GM', country_name: 'Gambia', country_name_cn: '冈比亚', mining_multiplier: 2 },
  { country_code: 'ME', country_name: 'Montenegro', country_name_cn: '黑山', mining_multiplier: 2 },
  { country_code: 'TT', country_name: 'Trinidad and Tobago', country_name_cn: '特立尼达和多巴哥', mining_multiplier: 2 },
  { country_code: 'ST', country_name: 'Sao Tome and Principe', country_name_cn: '圣多美和普林西比岛', mining_multiplier: 2 },
  { country_code: 'RE', country_name: 'Reunion', country_name_cn: '留尼汪', mining_multiplier: 2 },
  { country_code: 'PW', country_name: 'Palau', country_name_cn: '帕劳', mining_multiplier: 2 },
  { country_code: 'GU', country_name: 'Guam', country_name_cn: '关岛', mining_multiplier: 2 },
  { country_code: 'AW', country_name: 'Aruba', country_name_cn: '阿鲁巴', mining_multiplier: 2 },
  { country_code: 'GW', country_name: 'Guinea-Bissau', country_name_cn: '几内亚比绍', mining_multiplier: 2 },
  { country_code: 'SL', country_name: 'Sierra Leone', country_name_cn: '塞拉利昂', mining_multiplier: 2 },
  { country_code: 'CV', country_name: 'Cape Verde', country_name_cn: '佛得角', mining_multiplier: 2 },
  { country_code: 'PG', country_name: 'Papua New Guinea', country_name_cn: '巴布亚新几内亚', mining_multiplier: 2 },
  { country_code: 'NA', country_name: 'Namibia', country_name_cn: '纳米比亚', mining_multiplier: 2 },
  { country_code: 'BZ', country_name: 'Belize', country_name_cn: '伯利兹', mining_multiplier: 2 },
  { country_code: 'ZW', country_name: 'Zimbabwe', country_name_cn: '津巴布韦', mining_multiplier: 2 },
  { country_code: 'AG', country_name: 'Antigua and Barbuda', country_name_cn: '安提瓜和巴布达', mining_multiplier: 2 },
  { country_code: 'MD', country_name: 'Moldova, Republic of', country_name_cn: '摩尔多瓦共和国', mining_multiplier: 2 },
  { country_code: 'CF', country_name: 'Central African Republic', country_name_cn: '中非共和国', mining_multiplier: 2 },
  { country_code: 'JO', country_name: 'Jordan', country_name_cn: '约旦', mining_multiplier: 2 },
  { country_code: 'BN', country_name: 'Brunei Darussalam', country_name_cn: '文莱达鲁萨兰国', mining_multiplier: 2 },
  { country_code: 'DJ', country_name: 'Djibouti', country_name_cn: '吉布提', mining_multiplier: 2 },
  { country_code: 'GN', country_name: 'Guinea', country_name_cn: '几内亚', mining_multiplier: 2 },
  { country_code: 'ML', country_name: 'Mali', country_name_cn: '马里', mining_multiplier: 2 },
  { country_code: 'AM', country_name: 'Armenia', country_name_cn: '亚美尼亚', mining_multiplier: 2 },
  { country_code: 'MN', country_name: 'Mongolia', country_name_cn: '蒙古', mining_multiplier: 2 },
  { country_code: 'BA', country_name: 'Bosnia and herzegovina', country_name_cn: '波斯尼亚和黑塞哥维那', mining_multiplier: 2 },
  { country_code: 'DO', country_name: 'Dominican Republic', country_name_cn: '多米尼加共和国', mining_multiplier: 2 },
  { country_code: 'SX', country_name: 'Sint Maarten (Dutch part)', country_name_cn: '圣马丁岛（荷兰部分）', mining_multiplier: 2 },
  { country_code: 'SV', country_name: 'El Salvador', country_name_cn: '萨尔瓦多', mining_multiplier: 2 },
  { country_code: 'SR', country_name: 'Suriname', country_name_cn: '苏里南', mining_multiplier: 2 },
  { country_code: 'XK', country_name: 'Kosovo', country_name_cn: '科索沃', mining_multiplier: 2 },
  { country_code: 'MR', country_name: 'Mauritania', country_name_cn: '毛里塔尼亚', mining_multiplier: 2 },
  { country_code: 'TD', country_name: 'Chad', country_name_cn: '乍得', mining_multiplier: 2 },
  { country_code: 'MK', country_name: 'Macedonia, the Former Yugoslav Republic of', country_name_cn: '马其顿', mining_multiplier: 2 },
  { country_code: 'GT', country_name: 'Guatemala', country_name_cn: '危地马拉', mining_multiplier: 2 },
  { country_code: 'AZ', country_name: 'Azerbaijan', country_name_cn: '阿塞拜疆', mining_multiplier: 2 },
  { country_code: 'LK', country_name: 'Sri Lanka', country_name_cn: '斯里兰卡', mining_multiplier: 2 },
  { country_code: 'LB', country_name: 'Lebanon', country_name_cn: '黎巴嫩', mining_multiplier: 2 },
  { country_code: 'BO', country_name: 'Bolivia', country_name_cn: '玻利维亚', mining_multiplier: 2 },
  { country_code: 'MM', country_name: 'Myanmar', country_name_cn: '缅甸', mining_multiplier: 2 },
  { country_code: 'VN', country_name: 'Viet Nam', country_name_cn: '越南', mining_multiplier: 2 },
  { country_code: 'MA', country_name: 'Morocco', country_name_cn: '摩洛哥', mining_multiplier: 2 },
  { country_code: 'GH', country_name: 'Ghana', country_name_cn: '加纳', mining_multiplier: 2 },
  { country_code: 'GY', country_name: 'Guyana', country_name_cn: '圭亚那', mining_multiplier: 2 },
  { country_code: 'ZM', country_name: 'Zambia', country_name_cn: '赞比亚', mining_multiplier: 2 },
  { country_code: 'PY', country_name: 'Paraguay', country_name_cn: '巴拉圭', mining_multiplier: 2 },
  { country_code: 'EG', country_name: 'Egypt', country_name_cn: '埃及', mining_multiplier: 2 },
  { country_code: 'CM', country_name: 'Cameroon', country_name_cn: '喀麦隆', mining_multiplier: 2 },
  { country_code: 'AO', country_name: 'Angola', country_name_cn: '安哥拉', mining_multiplier: 2 },
  { country_code: 'KE', country_name: 'Kenya', country_name_cn: '肯尼亚', mining_multiplier: 2 },
  { country_code: 'TZ', country_name: 'Tanzania, United Republic of', country_name_cn: '坦桑尼亚联合共和国', mining_multiplier: 2 },
  { country_code: 'BW', country_name: 'Botswana', country_name_cn: '博茨瓦纳', mining_multiplier: 2 },
  { country_code: 'NG', country_name: 'Nigeria', country_name_cn: '尼日利亚', mining_multiplier: 2 },
  { country_code: 'ID', country_name: 'Indonesia', country_name_cn: '印度尼西亚', mining_multiplier: 2 },
  { country_code: 'GE', country_name: 'Georgia', country_name_cn: '格鲁吉亚', mining_multiplier: 2 },
  { country_code: 'RU', country_name: 'Russian Federation', country_name_cn: '俄罗斯联邦', mining_multiplier: 2 },
  { country_code: 'NI', country_name: 'Nicaragua', country_name_cn: '尼加拉瓜', mining_multiplier: 2 },
  { country_code: 'SS', country_name: 'South Sudan', country_name_cn: '南苏丹', mining_multiplier: 2 },
  { country_code: 'LR', country_name: 'Liberia', country_name_cn: '利比里亚', mining_multiplier: 2 },
  { country_code: 'VC', country_name: 'Saint Vincent and the Grenadines', country_name_cn: '圣文森特和格林纳丁斯', mining_multiplier: 2 },
  { country_code: 'KH', country_name: 'Cambodia', country_name_cn: '柬埔寨', mining_multiplier: 2 },
  { country_code: 'PS', country_name: 'Palestinian Territory, Occupied', country_name_cn: '巴勒斯坦领土占领土', mining_multiplier: 2 },
  { country_code: 'GA', country_name: 'Gabon', country_name_cn: '加蓬', mining_multiplier: 2 },
  
  // 1倍速率国家
  { country_code: 'TC', country_name: 'Turks and Caicos Islands', country_name_cn: '特克斯和凯科斯群岛', mining_multiplier: 1 },
  { country_code: 'LI', country_name: 'Liechtenstein', country_name_cn: '列支敦士登', mining_multiplier: 1 },
  { country_code: 'MT', country_name: 'Malta', country_name_cn: '马耳他', mining_multiplier: 1 },
  { country_code: 'KI', country_name: 'Kiribati', country_name_cn: '基里巴斯', mining_multiplier: 1 },
  { country_code: 'MP', country_name: 'Northern Mariana Islands', country_name_cn: '北马里亚纳群岛', mining_multiplier: 1 },
  { country_code: 'GD', country_name: 'Grenada', country_name_cn: '格林纳达', mining_multiplier: 1 },
  { country_code: 'CK', country_name: 'Cook Islands', country_name_cn: '库克群岛', mining_multiplier: 1 },
  { country_code: 'VG', country_name: 'Virgin Islands, British', country_name_cn: '英属维尔京群岛', mining_multiplier: 1 },
  { country_code: 'AS', country_name: 'American Samoa', country_name_cn: '美属萨摩亚', mining_multiplier: 1 },
  { country_code: 'KY', country_name: 'Cayman Islands', country_name_cn: '开曼群岛', mining_multiplier: 1 },
  { country_code: 'BB', country_name: 'Barbados', country_name_cn: '巴巴多斯', mining_multiplier: 1 },
  { country_code: 'SB', country_name: 'Solomon Islands', country_name_cn: '所罗门群岛', mining_multiplier: 1 },
  { country_code: 'WS', country_name: 'Samoa', country_name_cn: '萨摩亚', mining_multiplier: 1 },
  { country_code: 'SC', country_name: 'Seychelles', country_name_cn: '塞舌尔', mining_multiplier: 1 },
  { country_code: 'UG', country_name: 'Uganda', country_name_cn: '乌干达', mining_multiplier: 1 },
  { country_code: 'SN', country_name: 'Senegal', country_name_cn: '塞内加尔', mining_multiplier: 1 },
  { country_code: 'AL', country_name: 'Albania', country_name_cn: '阿尔巴尼亚', mining_multiplier: 1 },
  { country_code: 'AD', country_name: 'Andorra', country_name_cn: '安道尔', mining_multiplier: 1 },
  { country_code: 'YE', country_name: 'Yemen', country_name_cn: '也门', mining_multiplier: 1 },
  { country_code: 'TM', country_name: 'Turkmenistan', country_name_cn: '土库曼斯坦', mining_multiplier: 1 },
  { country_code: 'BD', country_name: 'Bangladesh', country_name_cn: '孟加拉国', mining_multiplier: 1 },
  { country_code: 'SZ', country_name: 'Swaziland', country_name_cn: '斯威士兰', mining_multiplier: 1 },
  { country_code: 'IN', country_name: 'India', country_name_cn: '印度', mining_multiplier: 1 },
  { country_code: 'CI', country_name: "Cote D' Ivoire", country_name_cn: '科特迪瓦', mining_multiplier: 1 },
  { country_code: 'TG', country_name: 'Togo', country_name_cn: '多哥', mining_multiplier: 1 },
  { country_code: 'HT', country_name: 'Haiti', country_name_cn: '海地', mining_multiplier: 1 },
  { country_code: 'IQ', country_name: 'Iraq', country_name_cn: '伊拉克', mining_multiplier: 1 },
  { country_code: 'CN', country_name: 'China', country_name_cn: '中国', mining_multiplier: 1 },
  { country_code: 'DZ', country_name: 'Algeria', country_name_cn: '阿尔及利亚', mining_multiplier: 1 },
  { country_code: 'BF', country_name: 'Burkina Faso', country_name_cn: '布基纳法索', mining_multiplier: 1 },
  { country_code: 'MW', country_name: 'Malawi', country_name_cn: '马拉维', mining_multiplier: 1 },
  { country_code: 'TN', country_name: 'Tunisia', country_name_cn: '突尼斯', mining_multiplier: 1 },
  { country_code: 'CD', country_name: 'Congo, the Democratic Republic of the', country_name_cn: '刚果民主共和国', mining_multiplier: 1 },
  { country_code: 'MG', country_name: 'Madagascar', country_name_cn: '马达加斯加', mining_multiplier: 1 },
  { country_code: 'PK', country_name: 'Pakistan', country_name_cn: '巴基斯坦', mining_multiplier: 1 },
  { country_code: 'BJ', country_name: 'Benin', country_name_cn: '贝宁', mining_multiplier: 1 },
  { country_code: 'LY', country_name: 'Libyan Arab Jamahiriya', country_name_cn: '利比亚', mining_multiplier: 1 },
  { country_code: 'VE', country_name: 'Venezuela', country_name_cn: '委内瑞拉', mining_multiplier: 1 },
  { country_code: 'LC', country_name: 'Saint Lucia', country_name_cn: '圣卢西亚', mining_multiplier: 1 },
  { country_code: 'NE', country_name: 'Niger', country_name_cn: '尼日尔', mining_multiplier: 1 },
  { country_code: 'ET', country_name: 'Ethiopia', country_name_cn: '埃塞俄比亚', mining_multiplier: 1 },
  { country_code: 'SO', country_name: 'Somalia', country_name_cn: '索马里', mining_multiplier: 1 },
  { country_code: 'SD', country_name: 'Sudan', country_name_cn: '苏丹', mining_multiplier: 1 },
  { country_code: 'CG', country_name: 'Congo', country_name_cn: '刚果', mining_multiplier: 1 },
  { country_code: 'LA', country_name: "Lao People's Democractic Republic", country_name_cn: '老挝人民民主共和国', mining_multiplier: 1 },
  { country_code: 'BI', country_name: 'Burundi', country_name_cn: '布隆迪', mining_multiplier: 1 },
  { country_code: 'MF', country_name: 'Saint Martin (French part)', country_name_cn: '圣马丁（法语部分）', mining_multiplier: 1 },
  { country_code: 'RW', country_name: 'Rwanda', country_name_cn: '卢旺达', mining_multiplier: 1 },
  { country_code: 'AF', country_name: 'Afghanistan', country_name_cn: '阿富汗', mining_multiplier: 1 },
  { country_code: 'LS', country_name: 'Lesotho', country_name_cn: '莱索托', mining_multiplier: 1 },
  { country_code: 'BT', country_name: 'Bhutan', country_name_cn: '不丹', mining_multiplier: 1 },
  { country_code: 'NP', country_name: 'Nepal', country_name_cn: '尼泊尔', mining_multiplier: 1 },
  { country_code: 'TL', country_name: 'Timor-Leste', country_name_cn: '东帝汶', mining_multiplier: 1 }
];

async function updateAllCountryMiningConfig() {
  let connection;
  
  try {
    // 创建数据库连接
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '47.79.232.189',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'bitcoin_mining_master'
    });

    console.log('✅ 数据库连接成功\n');
    console.log(`📊 准备导入 ${countryConfigs.length} 个国家/地区的挖矿配置...\n`);

    // 插入/更新数据
    const insertSQL = `
      INSERT INTO country_mining_config 
        (country_code, country_name, country_name_cn, mining_multiplier, is_active)
      VALUES 
        (?, ?, ?, ?, TRUE)
      ON DUPLICATE KEY UPDATE
        country_name = VALUES(country_name),
        country_name_cn = VALUES(country_name_cn),
        mining_multiplier = VALUES(mining_multiplier),
        updated_at = CURRENT_TIMESTAMP
    `;

    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    console.log('🔄 开始批量导入...\n');

    for (const config of countryConfigs) {
      try {
        const [result] = await connection.execute(insertSQL, [
          config.country_code,
          config.country_name,
          config.country_name_cn,
          config.mining_multiplier
        ]);

        if (result.affectedRows === 1) {
          insertedCount++;
          console.log(`   ✓ 插入: ${config.country_code.padEnd(3)} - ${config.country_name_cn.padEnd(20)} (${config.mining_multiplier}x)`);
        } else {
          updatedCount++;
          console.log(`   ↻ 更新: ${config.country_code.padEnd(3)} - ${config.country_name_cn.padEnd(20)} (${config.mining_multiplier}x)`);
        }
      } catch (err) {
        errorCount++;
        console.log(`   ✗ 失败: ${config.country_code} - ${err.message}`);
      }
    }

    console.log(`\n✅ 数据导入完成:`);
    console.log(`   新增: ${insertedCount} 条`);
    console.log(`   更新: ${updatedCount} 条`);
    if (errorCount > 0) {
      console.log(`   失败: ${errorCount} 条`);
    }

    // 验证数据
    console.log('\n📊 验证数据...\n');
    
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_countries,
        COUNT(DISTINCT mining_multiplier) as multiplier_levels,
        MIN(mining_multiplier) as min_multiplier,
        MAX(mining_multiplier) as max_multiplier,
        AVG(mining_multiplier) as avg_multiplier
      FROM country_mining_config
      WHERE is_active = TRUE
    `);

    console.log('统计信息:');
    console.log(`   总国家数: ${stats[0].total_countries}`);
    console.log(`   倍率等级: ${stats[0].multiplier_levels} 个`);
    console.log(`   最低倍率: ${stats[0].min_multiplier}x`);
    console.log(`   最高倍率: ${stats[0].max_multiplier}x`);
    console.log(`   平均倍率: ${parseFloat(stats[0].avg_multiplier).toFixed(2)}x`);

    // 按倍率分组统计
    const [groupStats] = await connection.execute(`
      SELECT 
        mining_multiplier,
        COUNT(*) as country_count
      FROM country_mining_config
      WHERE is_active = TRUE
      GROUP BY mining_multiplier
      ORDER BY mining_multiplier DESC
    `);

    console.log('\n倍率分布:');
    groupStats.forEach(row => {
      console.log(`   ${row.mining_multiplier}x: ${row.country_count} 个国家`);
    });

    console.log('\n🎉 全部完成!\n');

  } catch (error) {
    console.error('❌ 执行失败:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('👋 数据库连接已关闭');
    }
  }
}

// 执行脚本
if (require.main === module) {
  updateAllCountryMiningConfig()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = updateAllCountryMiningConfig;

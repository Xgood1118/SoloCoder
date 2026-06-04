import type { Photo, Album, Team, SyncConflict } from '../types'

export const teams: Team[] = [
  { id: 't1', name: '市场部', color: '#3B82F6' },
  { id: 't2', name: '产品部', color: '#10B981' },
  { id: 't3', name: '研发部', color: '#8B5CF6' },
  { id: 't4', name: '人力资源', color: '#F59E0B' },
]

export const albums: Album[] = [
  {
    id: 'a1',
    name: '2024年会照片',
    description: '公司年度盛典精彩瞬间',
    coverPhotoId: 'p1',
    visibility: 'team',
    createdAt: new Date(2024, 0, 15),
    updatedAt: new Date(2024, 0, 20),
    photoCount: 156,
    sortBy: 'takenAt',
    sortOrder: 'desc',
    createdBy: 'user1',
    teamIds: ['t1', 't2', 't3', 't4'],
  },
  {
    id: 'a2',
    name: '产品发布会',
    description: '新产品线发布活动',
    coverPhotoId: 'p5',
    visibility: 'team',
    createdAt: new Date(2024, 2, 10),
    updatedAt: new Date(2024, 2, 15),
    photoCount: 89,
    sortBy: 'takenAt',
    sortOrder: 'desc',
    createdBy: 'user2',
    teamIds: ['t2'],
  },
  {
    id: 'a3',
    name: '项目A里程碑',
    description: '重要项目节点记录',
    coverPhotoId: 'p10',
    visibility: 'private',
    createdAt: new Date(2024, 1, 5),
    updatedAt: new Date(2024, 1, 10),
    photoCount: 45,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    createdBy: 'user1',
  },
  {
    id: 'a4',
    name: '团队建设活动',
    description: '各部门团建活动照片',
    coverPhotoId: 'p15',
    visibility: 'public',
    createdAt: new Date(2024, 3, 1),
    updatedAt: new Date(2024, 3, 5),
    photoCount: 234,
    sortBy: 'takenAt',
    sortOrder: 'desc',
    createdBy: 'user3',
    teamIds: ['t1', 't2', 't3', 't4'],
  },
]

const sampleImages = [
  'https://images.unsplash.com/photo-1511578314322-379afb476865',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87',
  'https://images.unsplash.com/photo-1492684223066-81346ee00f66',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2',
  'https://images.unsplash.com/photo-1560472354-b33ff0c44a43',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c',
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4',
  'https://images.unsplash.com/photo-1552664730-d307ca884978',
  'https://images.unsplash.com/photo-1559136555-9303baea8ebd',
  'https://images.unsplash.com/photo-1551434678-e076c223a692',
  'https://images.unsplash.com/photo-1556761175-4b276360cd64',
  'https://images.unsplash.com/photo-1517048676732-8c3927a72a26',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46679',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c',
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f',
  'https://images.unsplash.com/photo-1531482615713-2afd69097956',
  'https://images.unsplash.com/photo-1552581234-263566ceb369',
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b',
]

const photoNames = [
  '年会合影.jpg', '产品展示.png', '团队活动.jpg', '办公环境.jpg',
  '发布会现场.jpg', '项目启动会.png', '团建烧烤.jpg', '年终总结.jpg',
  '新员工培训.jpg', '客户拜访.jpg', '技术分享.jpg', '节日庆祝.jpg',
  '产品原型图.jpg', '代码评审.jpg', '设计稿.png', '头脑风暴.jpg',
  '里程碑庆祝.jpg', '户外拓展.jpg', '会议室讨论.jpg', '下午茶时间.jpg',
]

const tags = [
  '年会', '产品', '团队', '办公', '发布会', '项目', '团建', '总结',
  '培训', '客户', '技术', '节日', '设计', '评审', '头脑风暴', '庆祝', '拓展'
]

export const photos: Photo[] = Array.from({ length: 50 }, (_, i) => {
  const imgIndex = i % sampleImages.length
  const isDuplicate = i < 6
  return {
    id: `p${i + 1}`,
    name: photoNames[i % photoNames.length],
    url: `${sampleImages[imgIndex]}?auto=format&fit=crop&w=800&q=80`,
    thumbnailUrl: `${sampleImages[imgIndex]}?auto=format&fit=crop&w=400&q=60`,
    size: Math.floor(Math.random() * 5000000) + 500000,
    takenAt: new Date(2024, Math.floor(Math.random() * 6), Math.floor(Math.random() * 28) + 1),
    createdAt: new Date(2024, Math.floor(Math.random() * 6), Math.floor(Math.random() * 28) + 1),
    updatedAt: new Date(2024, Math.floor(Math.random() * 6), Math.floor(Math.random() * 28) + 1),
    tags: tags.slice(0, Math.floor(Math.random() * 4) + 1),
    albumIds: ['a1', 'a2'].slice(0, Math.floor(Math.random() * 2) + 1),
    location: Math.random() > 0.3 ? {
      lat: 39.9 + Math.random() * 0.5,
      lng: 116.3 + Math.random() * 0.5,
      address: ['北京市朝阳区', '上海市浦东新区', '广州市天河区'][Math.floor(Math.random() * 3)],
    } : undefined,
    isDuplicate,
    duplicateGroupId: isDuplicate ? 'dup1' : undefined,
    syncStatus: ['synced', 'synced', 'conflict', 'synced', 'pending'][Math.floor(Math.random() * 5)] as Photo['syncStatus'],
    deviceId: ['device-ios', 'device-android', 'device-web'][Math.floor(Math.random() * 3)],
    hash: `hash-${i}`,
  }
})

export const syncConflicts: SyncConflict[] = [
  {
    id: 'c1',
    photoId: 'p3',
    photoName: '项目启动会.png',
    devices: ['iPhone 14 Pro', 'MacBook Pro', 'Web Upload'],
    createdAt: new Date(2024, 2, 15),
    resolved: false,
  },
  {
    id: 'c2',
    photoId: 'p7',
    photoName: '团建烧烤.jpg',
    devices: ['Android Phone', 'iPad'],
    createdAt: new Date(2024, 1, 20),
    resolved: false,
  },
]

export const allTags = tags

import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export const departmentApi = {
  getAll: () => api.get("/departments"),
  getById: (id: number) => api.get(`/departments/${id}`),
};

export const doctorApi = {
  getAll: () => api.get("/doctors"),
  getByDepartment: (departmentId: number) =>
    api.get(`/doctors/department/${departmentId}`),
  getById: (id: number) => api.get(`/doctors/${id}`),
};

export const scheduleApi = {
  getByDoctor: (doctorId: number) => api.get(`/schedules/doctor/${doctorId}`),
  getWeekly: (doctorId: number, startDate: string) =>
    api.get(`/schedules/doctor/${doctorId}/weekly/${startDate}`),
};

export const appointmentApi = {
  getSlots: (doctorId: number, date: string) =>
    api.get(`/appointments/slots/${doctorId}/${date}`),
  create: (data: any) => api.post("/appointments", data),
  cancel: (id: number, reason: string) =>
    api.post(`/appointments/${id}/cancel`, { reason }),
  getByPatient: (patientId: number, status?: string) =>
    api.get(`/appointments/patient/${patientId}${status ? `?status=${status}` : ""}`),
  getByDoctor: (doctorId: number, date?: string, status?: string) => {
    let url = `/appointments/doctor/${doctorId}`;
    const params = [];
    if (date) params.push(`date=${date}`);
    if (status) params.push(`status=${status}`);
    if (params.length > 0) url += `?${params.join("&")}`;
    return api.get(url);
  },
  complete: (id: number) => api.post(`/appointments/${id}/complete`),
};

export const patientApi = {
  getAll: () => api.get("/patients"),
  getById: (id: number) => api.get(`/patients/${id}`),
  create: (data: any) => api.post("/patients", data),
  update: (id: number, data: any) => api.put(`/patients/${id}`, data),
};

export const medicalRecordApi = {
  getByPatient: (patientId: number) =>
    api.get(`/medical-records/patient/${patientId}`),
  getByAppointment: (appointmentId: number) =>
    api.get(`/medical-records/appointment/${appointmentId}`),
  create: (data: any) => api.post("/medical-records", data),
  update: (id: number, data: any) =>
    api.put(`/medical-records/${id}`, data),
};

export const prescriptionApi = {
  searchMedicine: (keyword: string) =>
    api.get(`/prescriptions/medicine/search?keyword=${keyword}`),
  getByPatient: (patientId: number) =>
    api.get(`/prescriptions/patient/${patientId}`),
  getByRecord: (recordId: number) =>
    api.get(`/prescriptions/record/${recordId}`),
  create: (data: any) => api.post("/prescriptions", data),
  issue: (id: number) => api.post(`/prescriptions/${id}/issue`),
  dispense: (id: number) => api.post(`/prescriptions/${id}/dispense`),
  cancel: (id: number) => api.post(`/prescriptions/${id}/cancel`),
};

export const notificationApi = {
  getByPatient: (patientId: number) =>
    api.get(`/notifications/patient/${patientId}`),
  markAsRead: (id: number) => api.post(`/notifications/${id}/read`),
  markAllAsRead: (patientId: number) =>
    api.post(`/notifications/patient/${patientId}/read-all`),
};

export default api;

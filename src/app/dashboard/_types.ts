export type SchoolMini = { id: string; name: string };

export type MySchoolJoin = {
    id: string;
    schools: SchoolMini | null;
};

export type AppJoin = {
    id: string;
    decision_type: string | null;
    platform: string | null;
    deadline_date: string | null;
    status: string | null;
    my_school_id: string | null;
    my_schools: MySchoolJoin | null;
};

export type TaskJoin = {
    id: string;
    title: string;
    due_date: string | null;
    done: boolean;
    application_id: string | null;
    applications: AppJoin | null;
};

export type CalendarCounts = {
    tasksDue: number;
    appsDue: number;
};

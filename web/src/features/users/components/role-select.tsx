import { FormSelect } from "@/components/form/select";

const OPTIONS = [
  { label: "Admin", value: "admin" },
  { label: "User", value: "user" },
];

type RoleSelectProps = {
  name: string;
  label?: string;
  disabled?: boolean;
  fieldclassname?: string;
};

export function RoleSelect({ name, label = "Role", disabled, fieldclassname }: RoleSelectProps) {
  return (
    <FormSelect
      name={name}
      label={label}
      options={OPTIONS}
      placeholder="Select a role"
      disabled={disabled}
      fieldclassname={fieldclassname}
    />
  );
}

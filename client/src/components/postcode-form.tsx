import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { postcodeSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Search, MapPin } from "lucide-react";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";

const formSchema = postcodeSchema.extend({
  area: z
    .number({ invalid_type_error: "Enter a number" })
    .positive("Area must be greater than 0"),
  unit: z.enum(["ha", "ac"]),
});

type FormInput = z.infer<typeof formSchema>;

interface PostcodeFormProps {
  onSubmit: (postcode: string, areaHa: number) => void;
  isLoading: boolean;
}

export function PostcodeForm({ onSubmit, isLoading }: PostcodeFormProps) {
  const form = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: { postcode: "", area: 0.5, unit: "ha" },
  });

  const handleSubmit = (data: FormInput) => {
    const postcode = data.postcode.trim().toUpperCase();
    const areaHa = data.unit === "ha" ? data.area : data.area * 0.40468564224;
    onSubmit(postcode, areaHa);
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="pt-5 pb-5">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="postcode"
              render={({ field }) => (
                <FormItem>
                  <Label className="text-xs text-muted-foreground">UK Postcode</Label>
                  <FormControl>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        {...field}
                        placeholder="e.g. CA6 5QN"
                        className="pl-9 uppercase"
                        data-testid="input-postcode"
                        autoComplete="postal-code"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Land area</Label>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        onChange={(e) => field.onChange(e.target.value === "" ? NaN : Number(e.target.value))}
                        placeholder="0.5"
                        data-testid="input-area"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-xs text-muted-foreground">Unit</Label>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger data-testid="select-area-unit">
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ha">hectares</SelectItem>
                          <SelectItem value="ac">acres</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" disabled={isLoading} data-testid="button-search" className="w-full mt-1">
              <Search className="h-4 w-4 mr-2" />
              Calculate
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

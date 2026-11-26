"use client";

import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";

interface ImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onUpload: () => void;
}

export function ImportDialog({ open, onOpenChange, onFileChange, onUpload }: ImportDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                title="Import CSV"
                description="Upload a CSV file to create configuration items in bulk."
                footer={
                    <>
                        <Button variant="secondary" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button onClick={onUpload}>Upload CSV</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Field label="CSV file" htmlFor="items-csv-file">
                        <input
                            id="items-csv-file"
                            type="file"
                            accept=".csv"
                            onChange={onFileChange}
                            className="w-full min-w-0 rounded-md border border-border-strong bg-surface text-sm text-text file:mr-3 file:h-9 file:cursor-pointer file:border-0 file:bg-surface-2 file:px-3 file:text-sm file:font-medium file:text-text max-sm:file:h-11"
                        />
                    </Field>
                    <div className="rounded-md border border-border bg-surface-2 p-3 text-xs text-text">
                        <p className="mb-2 font-medium">Example CSV format</p>
                        <pre className="overflow-x-auto font-mono text-[12px] leading-relaxed">
{`Name,Description,IP,MAC,ItemTypeId,Status
Server 1,Main server,192.168.1.10,00:11:22:33:44:55,abc123,ACTIVE`}
                        </pre>
                        <p className="mt-2 text-muted">Status: ACTIVE, MAINTENANCE, DEPRECATED</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

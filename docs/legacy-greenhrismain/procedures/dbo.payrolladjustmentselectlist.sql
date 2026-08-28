
-- =============================================
-- Author:      <Pat Relos>
-- Create date: <11-8-2023>
-- Description: <use in datagrid view list employee with loan>
-- =============================================

CREATE PROCEDURE [dbo].[payrolladjustmentselectlist]

    @keytext      VARCHAR(50),
    @iddepartment INT,
    @idclient     INT,
    @status       VARCHAR(20)

AS
BEGIN

    SET NOCOUNT ON;

    -------------------------------------------------
    -- Clean first
    -------------------------------------------------

    UPDATE Employee
    SET tempforthirteenmonthstatus = NULL
    FROM Employee
    INNER JOIN payroll_summary
        ON Employee.Employee_id = payroll_summary.Employee_id;

    UPDATE Employee
    SET tempforthirteenmonthstatus = 'Active'
    FROM Employee
    INNER JOIN payroll_summary
        ON Employee.Employee_id = payroll_summary.Employee_id
    WHERE payroll_summary.idclientp = @idclient;

    -------------------------------------------------
    -- WITHOUT STATUS
    -------------------------------------------------

    IF (@status IS NULL OR @status = '')
    BEGIN

SELECT        Employee_id, maxdrate, lname, fname, mname, dailyrate, idclient, jobposition, Department_desc, companyname, department_code, typeofcontract, tagdelete, Position1, paythrough, bankaccountno, employee_status, 
                         bankname, tempforthirteenmonthstatus
FROM            payrolladjustmentselectviewlist
WHERE        (idclient = @idclient) AND (department_code = @iddepartment) AND (tagdelete = N'N') AND (fname LIKE N'%' + @keytext + N'%') OR
                         (idclient = @idclient) AND (department_code = @iddepartment) AND (tagdelete = N'N') AND (lname LIKE N'%' + @keytext + N'%')
ORDER BY lname, fname DESC

    END

    -------------------------------------------------
    -- WITH STATUS
    -------------------------------------------------

    IF (@status is NULL AND @status <> '')
    BEGIN

       SELECT        Employee_id, maxdrate, lname, fname, mname, dailyrate, idclient, jobposition, Department_desc, companyname, department_code, typeofcontract, tagdelete, Position1, paythrough, bankaccountno, employee_status, 
                         bankname, tempforthirteenmonthstatus
FROM            payrolladjustmentselectviewlist
WHERE        (idclient = @idclient) AND (department_code = @iddepartment) AND (tagdelete = N'N') AND (fname LIKE N'%' + @keytext + N'%') OR
                         (idclient = @idclient) AND (department_code = @iddepartment) AND (tagdelete = N'N') AND (lname LIKE N'%' + @keytext + N'%')
ORDER BY lname, fname DESC

    END

END

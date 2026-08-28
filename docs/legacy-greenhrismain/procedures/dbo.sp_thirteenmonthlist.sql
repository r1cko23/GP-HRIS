-- =============================================
-- Author:		<Pat Relos>
-- Create date: <11-8-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[sp_thirteenmonthlist]
	-- Add the parameters for the stored procedure here
		@idclient int,
		@companyname nvarchar(50),
		@fromdate date,
		@enddate date,
		@payrollmonth nvarchar(20),
		@thirteenmonthyear nvarchar(4),
		@empstatus nvarchar(10),
		@fname nvarchar(50),
		@lname nvarchar(50),
		@choosedateoption nvarchar(10)
				
AS
BEGIN




SELECT        payroll_summary.Employee_id, 
Employee.fname, Employee.lname, 
Employee.mname, 
CASE WHEN SUM(payroll_summary.noofdayswork) > 26 THEN 26 ELSE SUM(payroll_summary.noofdayswork) END AS daysin, 
MAX(payroll_summary.dailyrate_payroll) AS maxdrate, 
COUNT(payroll_summary.Employee_id) AS noofmonths, 
SUM(payroll_summary.basic) AS SumOfbasic
FROM            payroll_summary INNER JOIN
                         Employee ON payroll_summary.Employee_id = Employee.Employee_id
WHERE 
   idclientp =  CASE WHEN @idclient = '' THEN idclientp ELSE @idclient END
 AND (@fromdate IS NULL OR Date_Start >= @fromdate)
 AND (@enddate IS NULL OR Date_End <= @enddate)
 AND (payrollmonth= CASE WHEN @payrollmonth = '' THEN payrollmonth ELSE @payrollmonth END)
 AND (thirteenmonthyear= CASE WHEN @thirteenmonthyear = '' THEN thirteenmonthyear ELSE @thirteenmonthyear END)
 AND (Employee.status= CASE WHEN @empstatus = '' THEN status ELSE @empstatus END)
 AND (Employee.fname= CASE WHEN @fname = '' THEN fname ELSE @fname END)
 AND (Employee.lname= CASE WHEN @lname = '' THEN lname ELSE @lname END)
   
	
GROUP BY payroll_summary.Employee_id, Employee.fname, Employee.lname, Employee.mname

END

-- =============================================
-- Author:		<Pat Relos>
-- Create date: <11-8-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[sp_thirteenmonthlistdetails]
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




SELECT     payroll_summary.Employee_id, Employee.fname, Employee.lname, Employee.mname, payroll_summary.dailyrate_payroll AS maxdrate, payroll_summary.basic, 
                      payroll_summary.netamount, payroll_summary.contributionSSSEE, payroll_summary.contributionPagibigEE, payroll_summary.contributionphilhealthEE, 
                      payroll_summary.grossalary, payroll_summary.companyname2, payroll_summary.noofhourswork, payroll_summary.noofdayswork, payroll_summary.payrollmonth, 
                      payroll_summary.idclientp, payroll_summary.thirteenmonthyear, Employee.status, payroll_summary.Date_Start, payroll_summary.Date_End, @fromdate AS dfrom, 
                      @enddate AS dend
FROM         payroll_summary INNER JOIN
                      Employee ON payroll_summary.Employee_id = Employee.Employee_id
WHERE     (payroll_summary.idclientp = CASE WHEN @idclient = '' THEN idclientp ELSE @idclient END) AND 
                      (payroll_summary.payrollmonth = CASE WHEN @payrollmonth = '' THEN payrollmonth ELSE @payrollmonth END) AND 
                      (payroll_summary.thirteenmonthyear = CASE WHEN @thirteenmonthyear = '' THEN thirteenmonthyear ELSE @thirteenmonthyear END) AND 
                      (Employee.status = CASE WHEN @empstatus = '' THEN status ELSE @empstatus END) AND 
                      (Employee.fname = CASE WHEN @fname = '' THEN fname ELSE @fname END) AND (Employee.lname = CASE WHEN @lname = '' THEN lname ELSE @lname END) 
                      AND (@fromdate IS NULL) AND (@enddate IS NULL) OR
                      (payroll_summary.idclientp = CASE WHEN @idclient = '' THEN idclientp ELSE @idclient END) AND 
                      (payroll_summary.payrollmonth = CASE WHEN @payrollmonth = '' THEN payrollmonth ELSE @payrollmonth END) AND 
                      (payroll_summary.thirteenmonthyear = CASE WHEN @thirteenmonthyear = '' THEN thirteenmonthyear ELSE @thirteenmonthyear END) AND 
                      (Employee.status = CASE WHEN @empstatus = '' THEN status ELSE @empstatus END) AND 
                      (Employee.fname = CASE WHEN @fname = '' THEN fname ELSE @fname END) AND (Employee.lname = CASE WHEN @lname = '' THEN lname ELSE @lname END) 
                      AND (payroll_summary.Date_Start >= @fromdate) AND (@enddate IS NULL) OR
                      (payroll_summary.idclientp = CASE WHEN @idclient = '' THEN idclientp ELSE @idclient END) AND 
                      (payroll_summary.payrollmonth = CASE WHEN @payrollmonth = '' THEN payrollmonth ELSE @payrollmonth END) AND 
                      (payroll_summary.thirteenmonthyear = CASE WHEN @thirteenmonthyear = '' THEN thirteenmonthyear ELSE @thirteenmonthyear END) AND 
                      (Employee.status = CASE WHEN @empstatus = '' THEN status ELSE @empstatus END) AND 
                      (Employee.fname = CASE WHEN @fname = '' THEN fname ELSE @fname END) AND (Employee.lname = CASE WHEN @lname = '' THEN lname ELSE @lname END) 
                      AND (payroll_summary.Date_End <= @enddate) AND (@fromdate IS NULL) OR
                      (payroll_summary.idclientp = CASE WHEN @idclient = '' THEN idclientp ELSE @idclient END) AND 
                      (payroll_summary.payrollmonth = CASE WHEN @payrollmonth = '' THEN payrollmonth ELSE @payrollmonth END) AND 
                      (payroll_summary.thirteenmonthyear = CASE WHEN @thirteenmonthyear = '' THEN thirteenmonthyear ELSE @thirteenmonthyear END) AND 
                      (Employee.status = CASE WHEN @empstatus = '' THEN status ELSE @empstatus END) AND 
                      (Employee.fname = CASE WHEN @fname = '' THEN fname ELSE @fname END) AND (Employee.lname = CASE WHEN @lname = '' THEN lname ELSE @lname END) 
                      AND (payroll_summary.Date_Start >= @fromdate) AND (payroll_summary.Date_End <= @enddate)
END

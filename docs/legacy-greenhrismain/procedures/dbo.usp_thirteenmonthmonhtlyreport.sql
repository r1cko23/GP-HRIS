-- =============================================
-- Author:		Pats Relos
-- Create date: <03-03-2024>
-- Description:	<Thirteenmontn Monthly Report>
-- =============================================
CREATE PROCEDURE [dbo].[usp_thirteenmonthmonhtlyreport]
@logname nvarchar(20),
@yearx nvarchar(20),
@empstatus nvarchar(20)

AS	

BEGIN


SET NOCOUNT ON;



--create table
CREATE TABLE #TempTable13monthmonthly (
    [ID] INT IDENTITY(1, 1) PRIMARY KEY,
   	[thirteenmonthyear] NVARCHAR(4),
	[empid] int,
	[idclient] int,
	[iddepartment] int,
	[fullname] NVARCHAR(100),
	[fullname2] NVARCHAR(100),
	[cuttoff] NVARCHAR(40),
	[date_start] date,
	[payout] NVARCHAR(20),
	[basic] float,
	[astodatestatus] NVARCHAR(50) default 'InActive',
	[payrolldate] date,
	[payrollmonth] NVARCHAR(100),
	[monthsort] int,
	[amount] float
	   	 	  
);

CREATE INDEX idx_empid ON #TempTable13monthmonthly (thirteenmonthyear);
CREATE INDEX idx_monthsort ON #TempTable13monthmonthly (monthsort);
CREATE INDEX idx_payrollmonth ON #TempTable13monthmonthly (payrollmonth);


INSERT INTO [#TempTable13monthmonthly]
                         (thirteenmonthyear
						 , empid, idclient
						 , iddepartment
						 , fullname
						 , fullname2
						 , cuttoff
						 , date_start
						 , payout
						 , basic
						 , astodatestatus
						 , payrolldate
						 , payrollmonth
						 , monthsort
						 ,amount
					
						 )

SELECT thirteenmonthyear
	, Employee_id
	, idclient
	, iddepartment
	, fullname
	, fullname2
	, cuttoff
	, Date_Start
	, payrolldate1
	, basic
	, 'InActive' AS empstat
	, payrolldate
	, FORMAT(payrolldate, 'MMMM yyyy') as payrollmonth
	, FORMAT(payrolldate, 'yyyMM') AS monthsort
	, basic/12	
FROM            viewthirteenmonthmonitoring
WHERE        (thirteenmonthyear = @yearx)



 UPDATE       [#TempTable13monthmonthly]
		SET          astodatestatus = 'Active', idclient = lastpayrollemployeefinal.idclientp, iddepartment = lastpayrollemployeefinal.department_codep
		FROM            [#TempTable13monthmonthly]
						INNER JOIN
                        lastpayrollemployeefinal ON [#TempTable13monthmonthly].empid = lastpayrollemployeefinal.employee_id
										



-- Retrieve data from #TempTable
--SELECT * FROM [#TempTable13monthmonthly]  
--WHERE (astodatestatus= CASE WHEN @empstatus = '' THEN astodatestatus ELSE @empstatus END) 
--order by fullname2,payrolldate;




SELECT  client.companyname, [#TempTable13monthmonthly].*
from [#TempTable13monthmonthly] INNER JOIN
                        client ON [#TempTable13monthmonthly].idclient = client.idclient 
				--		INNER JOIN
                 --        Department ON [#TempTable13monthmonthly].iddepartment = Department.iddepartment

WHERE (astodatestatus= CASE WHEN @empstatus = '' THEN astodatestatus ELSE @empstatus END) 




-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTable13monthmonthly;





/*
if @empstatus = '' 
	BEGIN
		INSERT INTO #TempTable13monthmonthly (idclient,Companyname,amount,payrollmonth,monthsort,thirteenmonthyear,departmentcode)

				
		SELECT payroll_summary.idclientp, client.companyname, SUM(payroll_summary.thirteenmonth) AS amt,  FORMAT(payroll_summary.payrolldate, 'MMMM yyyy') AS formatted_date, FORMAT(payroll_summary.payrolldate, 'yyyMM') AS monthsort,payroll_summary.thirteenmonthyear,payroll_summary.department_codep
		FROM  payroll_summary INNER JOIN
              client ON payroll_summary.idclientp = client.idclient
		GROUP BY payroll_summary.idclientp, client.companyname,  FORMAT(payroll_summary.payrolldate, 'MMMM yyyy'),FORMAT(payroll_summary.payrolldate, 'yyyMM'),payroll_summary.thirteenmonthyear,department_codep
		HAVING        (payroll_summary.thirteenmonthyear =@yearx) and (payroll_summary.idclientp <> 46) --not include pico


		INSERT INTO #TempTable13monthmonthly (idclient,Companyname,amount,payrollmonth,monthsort,thirteenmonthyear,departmentcode)

		/*For Pico de loro Case joining 2 to department */				
		SELECT        100+''+payroll_summary.department_codep as idclient2, departmentdesc2, SUM(payroll_summary.thirteenmonth) AS amt,  FORMAT(payroll_summary.payrolldate, 'MMMM yyyy') AS formatted_date, FORMAT(payroll_summary.payrolldate, 'yyyMM') AS monthsort,payroll_summary.thirteenmonthyear,payroll_summary.department_codep
		FROM          payroll_summary INNER JOIN
              client ON payroll_summary.idclientp = client.idclient
		GROUP BY  departmentdesc2,  FORMAT(payroll_summary.payrolldate, 'MMMM yyyy'),FORMAT(payroll_summary.payrolldate, 'yyyMM'),payroll_summary.thirteenmonthyear,department_codep
		HAVING        (payroll_summary.thirteenmonthyear = @yearx) and (payroll_summary.department_codep = 26 or payroll_summary.department_codep = 25 )
				
	END

if @empstatus = 'Active'
	BEGIN
		
	END

*/



END





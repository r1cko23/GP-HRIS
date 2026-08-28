-- =============================================
-- Author:		Pats Relos
-- Create date: <10-28-2023>
-- Description:	<Thirteenmontn Monitoring Per Client>
-- =============================================
CREATE PROCEDURE [dbo].[usp_thirteenmonthmonitoringperclient]
@yearx nvarchar(20),
@idclientx int,
@empstatus varchar(10),
@iddepartmentx int,
@payoutdate date
AS	

BEGIN

--DECLARE @yearx nvarchar(20) = '2023'
--DECLARE @idclientx int =105
--DECLARE @payoutdate nvarchar(20) ='2023-10-15'


	SET NOCOUNT ON;

--create table
CREATE TABLE #TempTable3 (
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
	[payrolldate] date

   
);

-- Insert data from the payroll_summary table into the #TempTable
--DECLARE @payrollyear VARCHAR(20) = 'June 2023'
--DECLARE @idclient VARCHAR(8) = 'Active'
CREATE INDEX idx_idclient ON #TempTable3 (idclient);
CREATE INDEX idx_empid ON #TempTable3 (empid);
CREATE INDEX idx_astodatestatus ON #TempTable3 (astodatestatus);


--Get basic of employee per cuttoff 
	INSERT INTO #TempTable3 
		(thirteenmonthyear,
		empid,
		idclient,
		iddepartment,
		fullname,
		fullname2,
		cuttoff,
		date_start,
		payout,
		basic,
		astodatestatus,
		payrolldate)
		
	SELECT
		 thirteenmonthyear,
		 employee_id, 
		 idclient,
		 iddepartment,
		 fullname,
		 fullname2,
		 cuttoff,
		 date_start,
		 payrolldate1,
		 basic,
		 'InActive',
		 payrolldate
	FROM
		viewthirteenmonthmonitoring
	WHERE (viewthirteenmonthmonitoring.thirteenmonthyear = @yearx) 
	GROUP BY  companyname,thirteenmonthyear,Employee_id,idclient,iddepartment,fullname,fullname2,cuttoff,date_start,payrolldate1,basic,payrolldate

				
--Total basic as to date per employee 
	INSERT INTO #TempTable3 
		(thirteenmonthyear,
		empid,
		idclient,
		iddepartment,
		fullname,
		fullname2,
		cuttoff,
		date_start,
		basic,
		astodatestatus,
		payrolldate)

		--Total Basic as to date per empployee
		SELECT
		thirteenmonthyear,
		employee_id, 
		idclient,
		iddepartment,
		fullname,
		fullname2,
		'As to Date',
		'2000-01-02',
		sum(basic) as tbasic,
		'InActive',
		payrolldate
	FROM
		viewthirteenmonthmonitoring
	WHERE (viewthirteenmonthmonitoring.thirteenmonthyear = @yearx) 		
	GROUP BY  companyname,thirteenmonthyear,Employee_id,idclient,iddepartment,fullname,fullname2,cuttoff,date_start,payrolldate


--Total thirteenmonth of employee as to date
	INSERT INTO #TempTable3 
		(thirteenmonthyear,
		empid,idclient,
		iddepartment,
		fullname,
		fullname2,
		cuttoff,
		date_start,
		basic,
		astodatestatus,
		payrolldate)
		
		
	SELECT
		 thirteenmonthyear,
		 employee_id,
		 idclient,
		 iddepartment,
		 fullname,
		 fullname2,
		 'Total 13th Month',
		 '2000-01-01',
		 sum(basic)/12 as totalthit, 
		 'InActive',
		 payrolldate
	FROM
		viewthirteenmonthmonitoring			
		WHERE (viewthirteenmonthmonitoring.thirteenmonthyear = @yearx) 		
		GROUP BY  thirteenmonthyear,Employee_id,idclient,iddepartment,fullname,fullname2,cuttoff,date_start,payrolldate
	

	DECLARE @idemployee1 int
	DECLARE @idclientp1 int
	DECLARE @iddepartment1 int


	DECLARE myCursor CURSOR FOR
	
	SELECT   Employee_id, idclientp, department_codep  FROM lastpayrollemployeefinal  
	OPEN myCursor
	
	FETCH NEXT FROM myCursor INTO @idemployee1,@idclientp1,@iddepartment1
	
	WHILE @@FETCH_STATUS = 0
	BEGIN  
			--begin transaction
				--update latest idclient and 
				Update [#TempTable3]
				set idclient = @idclientp1,
				iddepartment = @iddepartment1
				where #TempTable3.empid = @idemployee1
			--commit
					

		FETCH NEXT FROM myCursor INTO @idemployee1,@idclientp1,@iddepartment1
	END
	CLOSE myCursor
	DEALLOCATE myCursor


	-------------------update Active employee this are employee who have salary in the given payoutdate 


	 DECLARE @idemployee2 int
	DECLARE @idclientp2 int
	DECLARE @iddepartment2 int


	DECLARE myCursor2 CURSOR FOR
	
	SELECT   Employee_id, idclientp, department_codep  FROM lastpayrollemployeefinal   where lastpayrollemployeefinal.pdate = @payoutdate
	OPEN myCursor2
	
	FETCH NEXT FROM myCursor2 INTO @idemployee1,@idclientp1,@iddepartment1
	
	WHILE @@FETCH_STATUS = 0
	BEGIN  
			begin transaction
				--update latest idclient and 
				Update [#TempTable3]
				set astodatestatus = 'Active'
				where #TempTable3.empid = @idemployee1
			commit
					

		FETCH NEXT FROM myCursor2 INTO @idemployee1,@idclientp1,@iddepartment1
	END
	CLOSE myCursor2
	DEALLOCATE myCursor2












--update active(reference should be all employee with last payroll) 
--if @empstatus = 'Active'
--	BEGIN


 /*  		
 UPDATE       [#TempTable3]
		SET          astodatestatus = 'Active', idclient = lastpayrollemployeefinal.idclientp, iddepartment = lastpayrollemployeefinal.department_codep
		FROM            [#TempTable3]
						INNER JOIN
                        lastpayrollemployeefinal ON [#TempTable3].empid = lastpayrollemployeefinal.employee_id
										

 */




 --select * from #TempTable3
 --where astodatestatus = 'Active'
			



-- Retrieve data from #TempTable
SELECT  Department.Department_desc as departmentgroup, client.companyname, #TempTable3.*
from #TempTable3 INNER JOIN
                        client ON #TempTable3.idclient = client.idclient INNER JOIN
                         Department ON #TempTable3.iddepartment = Department.iddepartment
WHERE (astodatestatus= CASE WHEN @empstatus = '' THEN astodatestatus ELSE @empstatus END) and (#TempTable3.idclient = @idclientx) 
order by fullname2,payrolldate;


-- Remember to drop the temporary table when you no longer need it
--DROP TABLE #TempTable3;

END

